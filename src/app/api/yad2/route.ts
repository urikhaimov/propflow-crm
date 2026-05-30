import { NextResponse } from 'next/server'
import { scrapeYad2WithApify } from '@/lib/apify'

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
  'Referer': 'https://www.yad2.co.il/',
  'Origin': 'https://www.yad2.co.il',
}

// Fetch the Yad2 homepage to receive session cookies Cloudflare expects on API calls.
async function getSessionCookie(): Promise<string> {
  try {
    const res = await fetch('https://www.yad2.co.il/', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
      redirect: 'follow',
    })
    const raw = res.headers.get('set-cookie') || ''
    // Extract cookie name=value pairs (strip attributes like Path, Domain, SameSite…)
    return raw
      .split(/,(?=[^ ])/)
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ')
  } catch {
    return ''
  }
}

const HEADERS = {
  ...BASE_HEADERS,
  'Accept': 'application/json, text/plain, */*',
}

const TARGETS = [
  { path: 'forsale', intent: 'seller',   label: 'נכס למכירה — יד2' },
  { path: 'rent',    intent: 'renter',   label: 'נכס להשכרה — יד2' },
]

interface Yad2Item {
  type?: string
  city?: string
  neighborhood?: string
  area_name?: string
  address?: string
  price?: number | string
  rooms?: number | string
  square_meters?: number | string
  info_text?: string
  row_4?: string
  link_token?: string
  id?: string
}

function buildPost(item: Yad2Item, label: string) {
  const city   = item.city || ''
  const hood   = item.neighborhood || item.area_name || ''
  const addr   = item.address || ''
  const title  = [addr, hood, city].filter(Boolean).join(', ')
  if (!title) return null

  const price  = item.price  ? `₪${Number(item.price).toLocaleString('he-IL')}` : ''
  const rooms  = item.rooms  ? `${item.rooms} חדרים` : ''
  const sqm    = item.square_meters ? `${item.square_meters} מ"ר` : ''
  const desc   = item.info_text || item.row_4 || ''
  const body   = [price, rooms, sqm, desc].filter(Boolean).join(' | ').substring(0, 400)
  const tok    = item.link_token || item.id || ''
  const url    = tok ? `https://www.yad2.co.il/item/${tok}` : 'https://www.yad2.co.il/realestate'

  return { title, body: `[${label}] ${body}`, url }
}

export async function GET() {
  const posts: Array<{ title: string; body: string; url: string }> = []
  const seen  = new Set<string>()
  const debug: string[] = []

  // Seed Cloudflare session cookies by visiting the homepage first
  const sessionCookie = await getSessionCookie()
  const headersWithCookie = sessionCookie
    ? { ...HEADERS, Cookie: sessionCookie }
    : HEADERS
  debug.push(`yad2 session cookie: ${sessionCookie ? `${sessionCookie.substring(0, 60)}…` : 'none'}`)

  for (const { path, label } of TARGETS) {
    // Try JSON API first
    const apiUrl = `https://gw.yad2.co.il/feed-search-legacy/realestate/${path}?priceOnly=0&page=1&rows=20&img=1`
    try {
      const res = await fetch(apiUrl, { headers: headersWithCookie, cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const items: Yad2Item[] = data?.data?.feed?.feed_items || []
        let added = 0
        for (const item of items) {
          if (item.type === 'commercial_area') continue
          const post = buildPost(item, label)
          if (!post) continue
          const fp = post.title.substring(0, 60)
          if (seen.has(fp)) continue
          seen.add(fp)
          posts.push(post)
          added++
        }
        debug.push(`yad2 ${path}: ${items.length} raw → ${added} added`)
        continue
      }
      debug.push(`yad2 ${path} API: HTTP ${res.status}`)
    } catch (err) {
      debug.push(`yad2 ${path} API error: ${String(err).substring(0, 60)}`)
    }

    // Fallback: HTML __NEXT_DATA__
    const htmlUrl = `https://www.yad2.co.il/realestate/${path}`
    try {
      const res = await fetch(htmlUrl, {
        headers: { ...headersWithCookie, Accept: 'text/html,application/xhtml+xml' },
        cache: 'no-store',
      })
      if (!res.ok) { debug.push(`yad2 ${path} HTML: HTTP ${res.status}`); continue }
      const html = await res.text()
      const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
      if (!m) { debug.push(`yad2 ${path} HTML: no __NEXT_DATA__`); continue }
      const json = JSON.parse(m[1])
      const pp = json?.props?.pageProps || {}
      const lists = pp.listings || pp.searchResults?.listings || pp.initialData?.listings || pp.data?.listings || []
      let added = 0
      for (const item of lists as Yad2Item[]) {
        const post = buildPost(item, label)
        if (!post) continue
        const fp = post.title.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)
        posts.push(post)
        added++
      }
      debug.push(`yad2 ${path} HTML: ${lists.length} raw → ${added} added`)
    } catch (err) {
      debug.push(`yad2 ${path} HTML error: ${String(err).substring(0, 60)}`)
    }
  }

  // ── Apify fallback — used when plain HTTP returns 0 (blocked or structure changed) ──
  if (posts.length === 0 && process.env.APIFY_TOKEN) {
    debug.push('yad2 plain HTTP returned 0 posts — trying Apify fallback...')
    try {
      const apifyPosts = await scrapeYad2WithApify(15)
      posts.push(...apifyPosts)
      debug.push(`yad2 Apify fallback: ${apifyPosts.length} posts`)
    } catch (err) {
      debug.push(`yad2 Apify fallback error: ${String(err).substring(0, 60)}`)
    }
  } else if (posts.length === 0) {
    debug.push('yad2: 0 posts — add APIFY_TOKEN to .env.local to enable Apify fallback')
  }

  return NextResponse.json({ source: 'yad2', count: posts.length, posts, debug })
}
