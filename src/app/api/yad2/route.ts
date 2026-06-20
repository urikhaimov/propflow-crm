import { NextResponse } from 'next/server'
import { scrapeStealthHtml } from '@/lib/stealth-scraper'

// Headless browser cold start + navigation can take a while — give it room.
export const maxDuration = 60

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
  'Referer': 'https://www.yad2.co.il/',
  'Origin': 'https://www.yad2.co.il',
}

// Fetch the Yad2 homepage to receive session cookies Cloudflare expects on subsequent calls.
async function getSessionCookie(): Promise<string> {
  try {
    const res = await fetch('https://www.yad2.co.il/', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
      redirect: 'follow',
    })
    const raw = res.headers.get('set-cookie') || ''
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
  'Accept': 'text/html,application/xhtml+xml',
}

// Yad2 redesigned their site since this scraper was built — the old
// gw.yad2.co.il JSON API and the bare /realestate/{path} URL (now just a
// category lobby page with no data) both no longer work. Real results require
// region/city query params, and the listings live in React Query's
// dehydratedState under a "realestate-{forsale|rent}-feed" key.
const TARGETS = [
  { path: 'forsale', label: 'נכס למכירה — יד2' },
  { path: 'rent',    label: 'נכס להשכרה — יד2' },
]

// Yad2's own city/area/topArea codes (pulled live from gw.yad2.co.il's
// address-autocomplete API — these are the same codes Yad2's search form uses).
// Keyed by the canonical Hebrew city name that extractCityFromText() produces.
// When a search names one of these cities, we scope the scrape to it; otherwise
// fall back to topArea=2 (the broad central-Israel region feed).
const YAD2_CITY_CODES: Record<string, { city: string; area: number; topArea: number }> = {
  'תל אביב':     { city: '5000', area: 1,  topArea: 2 },
  'ירושלים':     { city: '3000', area: 7,  topArea: 100 },
  'חיפה':        { city: '4000', area: 5,  topArea: 25 },
  'הרצליה':      { city: '6400', area: 18, topArea: 19 },
  'נתניה':       { city: '7400', area: 17, topArea: 19 },
  'רעננה':       { city: '8700', area: 42, topArea: 19 },
  'באר שבע':     { city: '9000', area: 22, topArea: 43 },
  'מודיעין':     { city: '1200', area: 8,  topArea: 2 },
  'רחובות':      { city: '8400', area: 12, topArea: 41 },
  'אשדוד':       { city: '0070', area: 21, topArea: 41 },
  'ראשון לציון': { city: '8300', area: 9,  topArea: 2 },
  'רמת גן':      { city: '8600', area: 3,  topArea: 2 },
  'בת ים':       { city: '6200', area: 11, topArea: 2 },
  'אילת':        { city: '2600', area: 24, topArea: 43 },
  'פתח תקווה':   { city: '7900', area: 4,  topArea: 2 },
  'גבעתיים':     { city: '6300', area: 3,  topArea: 2 },
  'חולון':       { city: '6600', area: 11, topArea: 2 },
}

// Builds the Yad2 search URL: city-scoped when we know the city's codes,
// otherwise the broad central-region feed.
function buildSearchUrl(path: string, city: string | null): string {
  const codes = city ? YAD2_CITY_CODES[city] : null
  if (codes) {
    return `https://www.yad2.co.il/realestate/${path}?topArea=${codes.topArea}&area=${codes.area}&city=${codes.city}`
  }
  return `https://www.yad2.co.il/realestate/${path}?topArea=2`
}

interface Yad2Item {
  address?: {
    city?: { text?: string }
    neighborhood?: { text?: string }
    street?: { text?: string }
  }
  price?: number
  token?: string
  additionalDetails?: {
    roomsCount?: number
    squareMeter?: number
    property?: { text?: string }
  }
}

/**
 * Extracts listings from a Yad2 search page's __NEXT_DATA__ JSON. Real estate
 * data lives inside React Query's dehydratedState, under a query keyed
 * "realestate-{forsale|rent}-feed" — not a simple top-level "listings" field.
 */
function extractListingsFromHtml(html: string): Yad2Item[] | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    const json = JSON.parse(m[1])
    const queries = json?.props?.pageProps?.dehydratedState?.queries || []
    const feedQuery = queries.find((q: { queryKey?: unknown[] }) => {
      const key = q.queryKey?.[0]
      return typeof key === 'string' && key.startsWith('realestate-') && key.endsWith('-feed') && key !== 'feed-literal'
    })
    const data = feedQuery?.state?.data
    if (!data) return null
    return [...(data.private || []), ...(data.agency || [])]
  } catch {
    return null
  }
}

function buildPost(item: Yad2Item, label: string) {
  const city = item.address?.city?.text || ''
  const hood = item.address?.neighborhood?.text || ''
  const street = item.address?.street?.text || ''
  const title = [street, hood, city].filter(Boolean).join(', ')
  if (!title) return null

  const price = item.price ? `₪${Number(item.price).toLocaleString('he-IL')}` : ''
  const rooms = item.additionalDetails?.roomsCount ? `${item.additionalDetails.roomsCount} חדרים` : ''
  const sqm   = item.additionalDetails?.squareMeter ? `${item.additionalDetails.squareMeter} מ"ר` : ''
  const type  = item.additionalDetails?.property?.text || ''
  const body  = [price, rooms, sqm, type].filter(Boolean).join(' | ').substring(0, 400)
  const url   = item.token ? `https://www.yad2.co.il/item/${item.token}` : 'https://www.yad2.co.il/realestate'

  return { title, body: `[${label}] ${body}`, url }
}

export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get('city')
  const posts: Array<{ title: string; body: string; url: string }> = []
  const seen  = new Set<string>()
  const debug: string[] = []

  const scoped = city && YAD2_CITY_CODES[city] ? city : null
  debug.push(scoped ? `yad2: scoping to city "${scoped}"` : `yad2: no city scope (broad central region)${city ? ` — "${city}" not in code map` : ''}`)

  // Seed Cloudflare session cookies by visiting the homepage first
  const sessionCookie = await getSessionCookie()
  const headersWithCookie = sessionCookie ? { ...HEADERS, Cookie: sessionCookie } : HEADERS
  debug.push(`yad2 session cookie: ${sessionCookie ? `${sessionCookie.substring(0, 60)}…` : 'none'}`)

  for (const { path, label } of TARGETS) {
    const htmlUrl = buildSearchUrl(path, scoped)
    let lists: Yad2Item[] | null = null

    try {
      const res = await fetch(htmlUrl, { headers: headersWithCookie, cache: 'no-store' })
      if (!res.ok) {
        debug.push(`yad2 ${path} HTML: HTTP ${res.status}`)
      } else {
        lists = extractListingsFromHtml(await res.text())
        if (!lists) debug.push(`yad2 ${path} HTML: no feed data (likely blocked)`)
      }
    } catch (err) {
      debug.push(`yad2 ${path} HTML error: ${String(err).substring(0, 60)}`)
    }

    // Free fallback: render via stealth headless browser — actually executes JS,
    // which can get past simple Cloudflare JS challenges plain fetch can't.
    // Not guaranteed against more advanced bot detection.
    if (!lists) {
      try {
        const html = await scrapeStealthHtml(htmlUrl, 'script#__NEXT_DATA__')
        lists = extractListingsFromHtml(html)
        debug.push(lists ? `yad2 ${path} stealth: got feed data` : `yad2 ${path} stealth: no feed data (still blocked)`)
      } catch (err) {
        debug.push(`yad2 ${path} stealth error: ${String(err).substring(0, 80)}`)
      }
    }

    if (lists) {
      let added = 0
      for (const item of lists) {
        const post = buildPost(item, label)
        if (!post) continue
        const fp = post.title.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)
        posts.push(post)
        added++
      }
      debug.push(`yad2 ${path}: ${lists.length} raw → ${added} added`)
    }
  }

  if (posts.length === 0) {
    debug.push('yad2: 0 posts — blocked on this IP (works from a residential IP / local run)')
  }

  return NextResponse.json({ source: 'yad2', count: posts.length, posts, debug })
}
