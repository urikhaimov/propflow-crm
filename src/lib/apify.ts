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

export interface ApifyScrapeFilters {
  cities?: string[]
  minRooms?: number
  propertyType?: string
  minPrice?: number
  maxPrice?: number
  dealType?: DealType
}

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

const DEAL_LABELS: Record<DealType, string> = { buy: 'נכס למכירה', rent: 'נכס להשכרה' }

export async function scrapeYad2WithApify(maxPerDeal = 15, filters: ApifyScrapeFilters = {}): Promise<ApifyPost[]> {
  const cities = filters.cities?.length ? filters.cities : CITIES
  const dealTypes: DealType[] = filters.dealType ? [filters.dealType] : ['buy', 'rent']

  const posts: ApifyPost[] = []
  const seen = new Set<string>()
  // Run one city at a time — 'all' (127+ cities) takes 3-5 min and times out.
  // Stop as soon as we have enough posts.
  for (const city of cities) {
    if (posts.length >= maxPerDeal * 2) break
    for (const dealType of dealTypes) {
      const input: Record<string, unknown> = {
        city,
        dealType,
        maxItems: Math.ceil(maxPerDeal / cities.length) + 1,
        enrichListings: false,
      }
      if (filters.minRooms) input.minRooms = filters.minRooms
      if (filters.minPrice) input.minPrice = filters.minPrice
      if (filters.maxPrice) input.maxPrice = filters.maxPrice

      const items = await runActor('swerve/yad2-scraper', input, maxPerDeal)

      for (const raw of items) {
        const item = raw as Record<string, unknown>
        const post = buildYad2Post(item, DEAL_LABELS[dealType])
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

export async function scrapeMadlanWithApify(maxPerDeal = 15, filters: ApifyScrapeFilters = {}): Promise<ApifyPost[]> {
  const cities = filters.cities?.length ? filters.cities : CITIES
  const dealTypes: DealType[] = filters.dealType ? [filters.dealType] : ['buy', 'rent']

  const posts: ApifyPost[] = []
  const seen = new Set<string>()

  for (const city of cities) {
    if (posts.length >= maxPerDeal * 2) break
    for (const dealType of dealTypes) {
      const input: Record<string, unknown> = {
        city,
        dealType,
        maxItems: Math.ceil(maxPerDeal / cities.length) + 1,
      }
      if (filters.minRooms) input.minRooms = filters.minRooms
      if (filters.propertyType) input.propertyType = filters.propertyType
      if (filters.minPrice) input.minPrice = filters.minPrice
      if (filters.maxPrice) input.maxPrice = filters.maxPrice

      const items = await runActor('swerve/madlan-scraper', input, maxPerDeal)

      for (const raw of items) {
        const item = raw as Record<string, unknown>
        const post = buildMadlanPost(item, DEAL_LABELS[dealType])
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

// Reddit blocks Vercel's datacenter IPs outright (HTTP 403) regardless of headers —
// parseforge/reddit-posts-scraper uses Apify's residential proxy pool to get around
// that. Pay-per-result pricing, no actor rental/subscription required.
export async function scrapeRedditWithApify(maxItems = 30): Promise<ApifyPost[]> {
  const items = await runActor('parseforge/reddit-posts-scraper', {
    subreddits: ['israelrealestate', 'aliyah', 'Israel', 'telaviv', 'Jerusalem'],
    searchQueries: ['apartment israel', 'דירה ישראל', 'apartment tel aviv'],
    sort: 'new',
    time: 'month',
    maxItems,
    postsPerSource: Math.ceil(maxItems / 3) + 2,
    proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
  }, maxItems)

  const posts: ApifyPost[] = []
  const seen = new Set<string>()

  for (const raw of items) {
    const item = raw as Record<string, unknown>
    const title = pick(item, 'title')
    const body  = pick(item, 'selfText', 'body', 'text')
    if (!title && !body) continue
    const fp = title.substring(0, 60)
    if (seen.has(fp)) continue
    seen.add(fp)

    const subreddit = pick(item, 'subreddit')
    const url = pick(item, 'permalink', 'url') || 'https://www.reddit.com'

    posts.push({
      title: title || body.substring(0, 80),
      body: `[r/${subreddit || 'Reddit'}] ${body}`.substring(0, 500),
      url,
    })
  }

  return posts
}
