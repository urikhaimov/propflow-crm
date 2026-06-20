// app/api/madlan/route.ts
// Fetches active real estate listings from madlan.co.il.
// The angle: every SELLER listing is a homeowner who wants to sell — a potential seller lead.
// Every RENTAL listing is a landlord — a potential investor/seller lead.
// We try __NEXT_DATA__ first (Madlan runs on Next.js), then JSON-LD, then regex.
import { NextResponse } from 'next/server'

// Note: Madlan runs PerimeterX, which serves an interactive CAPTCHA challenge
// page to any automated request (plain fetch AND headless browsers, regardless
// of stealth patches — confirmed by inspecting the rendered page directly).
// There is no free way past it; plain HTTP only works from a non-flagged IP,
// which in practice means it returns 0 on cloud/datacenter IPs like Vercel's.

const MADLAN_URLS = [
  { url: 'https://www.madlan.co.il/for-sale/israel', intent: 'seller' },
  { url: 'https://www.madlan.co.il/for-rent/israel',  intent: 'investor' },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
}

interface RawListing {
  title: string
  body: string
  url: string
}

// Extract listings from Madlan's __NEXT_DATA__ SSR JSON
function fromNextData(html: string): RawListing[] {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) return []

  try {
    const json = JSON.parse(m[1])
    // Madlan nests listings under different keys depending on the page version
    const pageProps = json?.props?.pageProps || {}
    const candidates = [
      pageProps.listings,
      pageProps.searchResults?.listings,
      pageProps.initialData?.listings,
      pageProps.data?.listings,
    ].filter(Boolean)

    const listings: RawListing[] = []
    for (const arr of candidates) {
      if (!Array.isArray(arr)) continue
      for (const item of arr) {
        const price = item.price ? `מחיר: ₪${Number(item.price).toLocaleString('he-IL')}` : ''
        const area  = item.area  ? `שטח: ${item.area} מ"ר` : ''
        const rooms = item.rooms ? `חדרים: ${item.rooms}` : ''
        const title = item.title || item.address || item.streetAddress || item.listingTitle || ''
        const city  = item.city  || item.cityName || ''
        const neighborhood = item.neighborhood || item.neighborhoodName || ''
        const desc  = item.description || item.listingDescription || ''

        if (!title && !city) continue

        listings.push({
          title: [title, city, neighborhood].filter(Boolean).join(' — '),
          body: [price, rooms, area, desc].filter(Boolean).join(' | ').substring(0, 400),
          url: item.url || item.listingUrl || item.link || '',
        })
      }
    }
    return listings
  } catch {
    return []
  }
}

// JSON-LD structured data fallback
function fromJsonLd(html: string): RawListing[] {
  const listings: RawListing[] = []
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        const type = item['@type'] || ''
        if (!['Apartment', 'SingleFamilyResidence', 'House', 'RealEstateListing', 'Product', 'Residence'].includes(type)) continue
        const price = item.offers?.price ? `₪${Number(item.offers.price).toLocaleString('he-IL')}` : ''
        listings.push({
          title: item.name || item.headline || '',
          body: [price, item.description || ''].filter(Boolean).join(' | ').substring(0, 400),
          url: item.url || '',
        })
      }
    } catch { /* skip */ }
  }
  return listings
}

// Regex fallback — extracts text from known Madlan listing card patterns
function fromRegex(html: string): RawListing[] {
  const listings: RawListing[] = []

  // Address / title blocks — common in Madlan card markup
  const titleRe = /class="[^"]*(?:listing-title|property-title|address|listing-address|card-title)[^"]*"[^>]*>([\s\S]{5,200}?)<\//gi
  let m
  while ((m = titleRe.exec(html)) !== null) {
    const title = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (title.length > 5) {
      listings.push({ title, body: '', url: '' })
    }
  }

  // Price elements near listing cards
  const priceRe = /(?:₪|NIS|שח)\s*[\d,\.]+(?:\s*(?:מיליון|אלף|M|K))?/gi
  if (listings.length > 0 && priceRe.test(html)) {
    // Prices found — add to last listing bodies as context
    const prices = html.match(priceRe) || []
    prices.slice(0, listings.length).forEach((p, i) => {
      if (listings[i]) listings[i].body = `מחיר: ${p}`
    })
  }

  return listings.slice(0, 30)
}

// Try extraction strategies in order of reliability
function extractListings(html: string): RawListing[] {
  let listings = fromNextData(html)
  if (listings.length === 0) listings = fromJsonLd(html)
  if (listings.length === 0) listings = fromRegex(html)
  return listings
}

export async function GET() {
  const posts: Array<{ title: string; body: string; url: string }> = []
  const seen = new Set<string>()
  const debug: string[] = []

  for (const { url, intent } of MADLAN_URLS) {
    let listings: RawListing[] = []
    try {
      const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
      if (res.ok) {
        listings = extractListings(await res.text())
        if (listings.length === 0) debug.push(`madlan ${intent}: plain HTTP returned 0 listings (blocked by PerimeterX)`)
      } else {
        debug.push(`madlan ${intent}: HTTP ${res.status}`)
      }
    } catch (err) {
      debug.push(`madlan ${intent} error: ${String(err).substring(0, 60)}`)
    }

    for (const listing of listings) {
      if (!listing.title && !listing.body) continue
      const fp = `${listing.title}${listing.body}`.substring(0, 60)
      if (seen.has(fp)) continue
      seen.add(fp)

      // Annotate with intent hint so Claude has more context
      const intentLabel = intent === 'seller' ? 'נכס למכירה' : 'נכס להשכרה'
      posts.push({
        title: listing.title,
        body: `[${intentLabel} — מדלן] ${listing.body}`,
        url: listing.url || url,
      })
    }
  }

  if (posts.length === 0) {
    debug.push('madlan: 0 posts — blocked by PerimeterX (works only from a non-flagged residential IP)')
  }

  return NextResponse.json({
    source: 'madlan',
    count: posts.length,
    posts,
    debug,
  })
}
