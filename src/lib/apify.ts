// lib/apify.ts — Apify fallback scrapers for Yad2 and Madlan
// Used when our plain HTTP routes return 0 posts (site blocked or changed structure).
// Requires APIFY_TOKEN env var. Cost: ~$5 / 1,000 results.

const APIFY_BASE = 'https://api.apify.com/v2'
const TIMEOUT_MS = 90_000 // 90s — generous ceiling; per-city calls finish in ~15-25s

// Major cities to scrape — split across sequential calls so each actor run is fast.
// Avoid 'all' (127+ cities): that makes the actor take 3-5 minutes and times out.
const CITIES = ['תל אביב', 'ירושלים', 'חיפה', 'נתניה', 'ראשון לציון']

export type ApifyPost = { title: string; body: string; url: string }

type DealType = 'buy' | 'rent'

// ── Generic actor runner ───────────────────────────────────────────────────
// Throws on any error so callers can surface the message in their debug log.
async function runActor(
  actorSlug: string,
  input: Record<string, unknown>,
  maxItems: number,
): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) return []

  const actorId = actorSlug.replace('/', '~')
  // timeout=80 asks Apify to wait up to 80 s for the actor before returning
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&maxItems=${maxItems}&timeout=80`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} — ${body.substring(0, 120)}`)
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`timed out after ${TIMEOUT_MS / 1000}s`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── Field helpers ──────────────────────────────────────────────────────────
function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v !== null && v !== undefined && v !== '') return String(v)
  }
  return ''
}

function buildYad2Post(item: Record<string, unknown>, dealLabel: string): ApifyPost | null {
  const address    = pick(item, 'address', 'street', 'streetAddress')
  const city       = pick(item, 'city', 'cityName')
  const hood       = pick(item, 'neighbourhood', 'neighborhood', 'area')
  const title      = [address, hood, city].filter(Boolean).join(', ')
  if (!title) return null

  const price  = pick(item, 'price', 'rentPrice', 'salePrice')
  const rooms  = pick(item, 'rooms', 'roomCount', 'numberOfRooms')
  const area   = pick(item, 'area', 'size', 'squareMeters', 'floorSize')
  const desc   = pick(item, 'description', 'info', 'text')
  const phone  = pick(item, 'phone', 'contactPhone', 'ownerPhone')
  const url    = pick(item, 'url', 'listingUrl', 'link') || 'https://www.yad2.co.il/realestate'

  const parts = [
    price  ? `₪${Number(price).toLocaleString('he-IL')}` : '',
    rooms  ? `${rooms} חדרים` : '',
    area   ? `${area} מ"ר` : '',
    desc,
  ].filter(Boolean)

  return {
    title,
    body: `[${dealLabel} — יד2 Apify] ${parts.join(' | ')}${phone ? ` | 📞 ${phone}` : ''}`.substring(0, 500),
    url,
  }
}

function buildMadlanPost(item: Record<string, unknown>, dealLabel: string): ApifyPost | null {
  const address = pick(item, 'address', 'streetAddress', 'street')
  const city    = pick(item, 'city', 'cityName')
  const hood    = pick(item, 'neighbourhood', 'neighborhood')
  const title   = [address, hood, city].filter(Boolean).join(', ')
  if (!title) return null

  const price = pick(item, 'price', 'rentPrice', 'salePrice')
  const rooms = pick(item, 'rooms', 'roomCount')
  const area  = pick(item, 'area', 'size', 'squareMeters')
  const desc  = pick(item, 'description', 'text')
  const phone = pick(item, 'phone', 'agentPhone', 'contactPhone')
  const url   = pick(item, 'url', 'listingUrl', 'link') || 'https://www.madlan.co.il'

  const parts = [
    price ? `₪${Number(price).toLocaleString('he-IL')}` : '',
    rooms ? `${rooms} חדרים` : '',
    area  ? `${area} מ"ר` : '',
    desc,
  ].filter(Boolean)

  return {
    title,
    body: `[${dealLabel} — מדלן Apify] ${parts.join(' | ')}${phone ? ` | 📞 ${phone}` : ''}`.substring(0, 500),
    url,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function scrapeYad2WithApify(maxPerDeal = 15): Promise<ApifyPost[]> {
  const posts: ApifyPost[] = []
  const seen = new Set<string>()
  // Run one city at a time — 'all' (127+ cities) takes 3-5 min and times out.
  // Stop as soon as we have enough posts.
  for (const city of CITIES) {
    if (posts.length >= maxPerDeal * 2) break
    for (const [dealType, label] of [['buy', 'נכס למכירה'], ['rent', 'נכס להשכרה']] as [DealType, string][]) {
      const items = await runActor('swerve/yad2-scraper', {
        city,
        dealType,
        maxItems: Math.ceil(maxPerDeal / CITIES.length) + 1,
        enrichListings: false,
      }, maxPerDeal)

      for (const raw of items) {
        const item = raw as Record<string, unknown>
        const post = buildYad2Post(item, label)
        if (!post) continue
        const fp = post.title.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)
        posts.push(post)
      }
    }
  }

  return posts
}

export async function scrapeMadlanWithApify(maxPerDeal = 15): Promise<ApifyPost[]> {
  const posts: ApifyPost[] = []
  const seen = new Set<string>()

  for (const city of CITIES) {
    if (posts.length >= maxPerDeal * 2) break
    for (const [dealType, label] of [['buy', 'נכס למכירה'], ['rent', 'נכס להשכרה']] as [DealType, string][]) {
      const items = await runActor('swerve/madlan-scraper', {
        city,
        dealType,
        maxItems: Math.ceil(maxPerDeal / CITIES.length) + 1,
      }, maxPerDeal)

      for (const raw of items) {
        const item = raw as Record<string, unknown>
        const post = buildMadlanPost(item, label)
        if (!post) continue
        const fp = post.title.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)
        posts.push(post)
      }
    }
  }

  return posts
}
