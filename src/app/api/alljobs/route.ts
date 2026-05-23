// app/api/alljobs/route.ts
// Fetches housing-related listings from alljobs.co.il and extracts relocation/housing signals.
// alljobs is a job board — the angle is: people relocating for work need housing.
// We look for (a) relocation packages / "העתקת מגורים" in job posts, and
// (b) the "דירות / שכירות" classifieds section alljobs hosts alongside jobs.
import { NextResponse } from 'next/server'

const HOUSING_KEYWORDS = [
  'מחפש דירה', 'מחפשת דירה', 'דירה להשכרה', 'דירה למכירה',
  'שכירות', 'להשכרה', 'שותף לדירה', 'שותפה לדירה',
  'העתקת מגורים', 'מוכן לעבור', 'נכון לעבור', 'דורש העתקה',
  'relocation', 'willing to relocate', 'need apartment',
  'looking for apartment', 'apartment needed', 'flat needed',
]

const CITY_SIGNALS = [
  'תל אביב', 'ירושלים', 'חיפה', 'הרצליה', 'רעננה', 'נתניה',
  'פתח תקווה', 'רמת גן', 'בני ברק', 'ראשון לציון', 'באר שבע',
  'מודיעין', 'רחובות', 'אשדוד', 'גבעתיים', 'הוד השרון',
  'tel aviv', 'jerusalem', 'haifa', 'herzliya', 'raanana',
]

// Extracts plain text from HTML — strips tags, collapses whitespace
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Extracts job/listing snippets from alljobs HTML using their data attributes and known class patterns
function extractListings(html: string): Array<{ title: string; body: string; url: string }> {
  const listings: Array<{ title: string; body: string; url: string }> = []

  // alljobs wraps each listing in a div with class "job-content" or data-job-id
  // Try multiple patterns to be resilient to layout changes
  const patterns = [
    // JSON-LD structured data (most reliable)
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    // og:title / og:description meta tags
    /<meta[^>]+property="og:(?:title|description)"[^>]+content="([^"]+)"/gi,
  ]

  // Try JSON-LD first
  let jsonLdMatch
  const jsonLdRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
  while ((jsonLdMatch = jsonLdRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdMatch[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'JobPosting' || item['@type'] === 'ListItem') {
          listings.push({
            title: item.title || item.name || '',
            body: item.description || item.hiringOrganization?.name || '',
            url: item.url || item.identifier?.value || '',
          })
        }
      }
    } catch { /* not valid JSON-LD */ }
  }

  // Fallback: extract text blocks between common alljobs listing markers
  if (listings.length === 0) {
    const titleRe = /class="[^"]*(?:job-title|position-title|listing-title)[^"]*"[^>]*>([^<]{5,120})</gi
    let m
    while ((m = titleRe.exec(html)) !== null) {
      const title = m[1].trim()
      if (title.length > 5) listings.push({ title, body: '', url: '' })
    }
  }

  return listings.slice(0, 40)
}

const SEARCH_URLS = [
  // Listings mentioning relocation or housing in the description
  'https://www.alljobs.co.il/SearchResultsWebCasualRiver.aspx?position=%D7%9E%D7%92%D7%95%D7%A8%D7%99%D7%9D&fromdate=14&sortby=1',
  // Jobs with relocation package
  'https://www.alljobs.co.il/SearchResultsWebCasualRiver.aspx?position=%D7%94%D7%A2%D7%AA%D7%A7%D7%AA+%D7%9E%D7%92%D7%95%D7%A8%D7%99%D7%9D&fromdate=14',
]

export async function GET() {
  const results: Array<{ title: string; body: string; url: string }> = []
  const seen = new Set<string>()

  for (const url of SEARCH_URLS) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PropFlowCRM/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
        },
        cache: 'no-store',
      })
      if (!res.ok) continue

      const html = await res.text()
      const listings = extractListings(html)

      for (const listing of listings) {
        const fullText = `${listing.title} ${listing.body}`.toLowerCase()
        const fp = fullText.substring(0, 60)
        if (seen.has(fp) || fp.length < 10) continue

        // Must mention a housing or relocation keyword
        const hasHousing = HOUSING_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()))
        // OR mention a city (potential relocation = potential renter/buyer)
        const hasCity = CITY_SIGNALS.some(city => fullText.includes(city.toLowerCase()))

        if (!hasHousing && !hasCity) continue
        seen.add(fp)

        results.push(listing)
      }
    } catch {
      continue
    }
  }

  return NextResponse.json({
    source: 'alljobs',
    count: results.length,
    posts: results,
  })
}
