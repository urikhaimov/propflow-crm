// lib/scraper-utils.ts — pure functions extracted from scraper routes so they can be unit-tested

export const INTENT_KEYWORDS = [
  'looking for apartment', 'looking to buy', 'looking to rent',
  'need apartment', 'want to buy', 'relocating to israel',
  'moving to israel', 'moving to tel aviv', 'moving to haifa',
  'moving to jerusalem', 'apartment in israel', 'flat in israel',
  'real estate israel', 'property for sale israel',
  'invest in israel', 'sell my apartment', 'for rent', 'for sale',
  'room for rent', 'studio for rent', 'apartment available',
  'מחפש דירה', 'מחפשת דירה', 'מוכר דירה', 'דירה למכירה',
  'דירה להשכרה', 'רוצה לקנות', 'מעוניין בדירה', 'נדלן', 'נדל"ן',
  'דירה', 'נכס', 'להשכיר', 'למכור', 'לקנות',
]

export const ISRAEL_SIGNALS = [
  'israel', 'israeli', 'tel aviv', 'jerusalem', 'haifa', 'herzliya',
  'netanya', 'beer sheva', 'raanana', 'modiin', 'rehovot', 'ashdod',
  'rishon', 'holon', 'petah tikva', 'ramat gan', 'bat yam', 'eilat',
  'תל אביב', 'ירושלים', 'חיפה', 'הרצליה', 'נתניה', 'רעננה',
  'באר שבע', 'מודיעין', 'רחובות', 'אשדוד', 'ראשון', 'רמת גן',
  'ישראל', 'בת ים', 'אילת', 'פתח תקווה', 'גבעתיים', 'חולון',
]

/** True if the text contains at least one real-estate intent keyword. */
export function hasIntentKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return INTENT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
}

/** True if the text mentions Israel or an Israeli city, or the post is from an Israel-specific subreddit. */
export function hasIsraelSignal(text: string, fromIsraelSub = false): boolean {
  if (fromIsraelSub) return true
  const lower = text.toLowerCase()
  return ISRAEL_SIGNALS.some(sig => lower.includes(sig.toLowerCase()))
}

// English/Hebrew spelling → canonical Hebrew city name
const CITY_NAME_MAP: Record<string, string> = {
  'tel aviv': 'תל אביב', 'תל אביב': 'תל אביב',
  jerusalem: 'ירושלים', ירושלים: 'ירושלים',
  haifa: 'חיפה', חיפה: 'חיפה',
  herzliya: 'הרצליה', הרצליה: 'הרצליה',
  netanya: 'נתניה', נתניה: 'נתניה',
  raanana: 'רעננה', רעננה: 'רעננה',
  'beer sheva': 'באר שבע', 'באר שבע': 'באר שבע',
  modiin: 'מודיעין', מודיעין: 'מודיעין',
  rehovot: 'רחובות', רחובות: 'רחובות',
  ashdod: 'אשדוד', אשדוד: 'אשדוד',
  'rishon lezion': 'ראשון לציון', rishon: 'ראשון לציון', 'ראשון לציון': 'ראשון לציון', ראשון: 'ראשון לציון',
  'ramat gan': 'רמת גן', 'רמת גן': 'רמת גן',
  'bat yam': 'בת ים', 'בת ים': 'בת ים',
  eilat: 'אילת', אילת: 'אילת',
  'petah tikva': 'פתח תקווה', 'פתח תקווה': 'פתח תקווה',
  givatayim: 'גבעתיים', גבעתיים: 'גבעתיים',
  holon: 'חולון', חולון: 'חולון',
}

/** Finds the first recognized Israeli city name (English or Hebrew) in free text, returns its canonical Hebrew form. */
export function extractCityFromText(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [key, canonical] of Object.entries(CITY_NAME_MAP)) {
    if (lower.includes(key.toLowerCase())) return canonical
  }
  return null
}

// canonical Hebrew city name → every spelling (Hebrew + English) that maps to it.
// Lets a Hebrew query word also match an English city mention in scraped text, and vice versa.
const CITY_ALIASES: Record<string, string[]> = {}
for (const [spelling, canonical] of Object.entries(CITY_NAME_MAP)) {
  ;(CITY_ALIASES[canonical] ??= []).push(spelling)
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  villa: 'villa', וילה: 'villa',
  penthouse: 'penthouse', פנטהאוז: 'penthouse',
  studio: 'studio', סטודיו: 'studio',
  commercial: 'commercial', מסחרי: 'commercial',
  land: 'land', מגרש: 'land', קרקע: 'land',
  apartment: 'apartment', דירה: 'apartment', דירת: 'apartment',
}

export interface SearchFilters {
  city: string | null
  minRooms?: number
  propertyType?: string
  maxPrice?: number
  dealType?: 'buy' | 'rent'
}

/**
 * Parses free-text search input for structured filters (city, rooms, property
 * type, budget, buy/rent intent) so callers can scope a scrape instead of
 * always pulling everything. Best-effort regex parsing, not full NLP.
 */
export function extractSearchFilters(text: string): SearchFilters {
  const lower = text.toLowerCase()

  const city = extractCityFromText(text)

  // "4 חדרים", "3.5 חד'", "4 room(s)"
  const roomsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:חדרים|חד['׳]|room)/)
  const minRooms = roomsMatch ? parseFloat(roomsMatch[1]) : undefined

  let propertyType: string | undefined
  for (const [key, val] of Object.entries(PROPERTY_TYPE_MAP)) {
    if (lower.includes(key)) { propertyType = val; break }
  }

  // "עד 3 מיליון", "up to 3M", or a raw 6+ digit number
  let maxPrice: number | undefined
  const millionMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:מיליון|million|m\b)/)
  if (millionMatch) {
    maxPrice = parseFloat(millionMatch[1]) * 1_000_000
  } else {
    const rawNumberMatch = lower.match(/\b(\d{6,9})\b/)
    if (rawNumberMatch) maxPrice = parseInt(rawNumberMatch[1], 10)
  }

  let dealType: 'buy' | 'rent' | undefined
  if (/(להשכרה|rent|rental|שכירות)/.test(lower)) dealType = 'rent'
  else if (/(לקנייה|לקניה|buy|purchase|מכירה)/.test(lower)) dealType = 'buy'

  return { city, minRooms, propertyType, maxPrice, dealType }
}

// dealType → acceptable intent_type values. Permissive (OR), not 1:1 — a "for
// sale" post is usually classified as a seller lead (the homeowner selling),
// not "buyer"; a rental post is often classified as an investor lead (the
// landlord), not "renter". Strict 1:1 mapping would wrongly drop valid leads.
const DEAL_TYPE_TO_INTENTS: Record<'buy' | 'rent', string[]> = {
  buy: ['seller', 'buyer'],
  rent: ['renter', 'investor'],
}

/**
 * True if a Claude-extracted lead matches the structured search filters.
 * Operates on Claude's own normalized output (city, intent_type), not raw
 * scraped text — avoids the script-mismatch/truncation issues that made
 * literal text matching unreliable on Yad2/Madlan/Telegram results.
 */
export function matchesExtractedLead(
  lead: { city?: string; intent_type?: string },
  filters: SearchFilters,
): boolean {
  if (filters.city && lead.city) {
    const a = lead.city.trim()
    const b = filters.city.trim()
    if (!a.includes(b) && !b.includes(a)) return false
  }
  if (filters.dealType && lead.intent_type) {
    if (!DEAL_TYPE_TO_INTENTS[filters.dealType].includes(lead.intent_type)) return false
  }
  return true
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'to', 'in', 'of', 'on', 'at', 'and', 'or', 'is',
  'i', 'need', 'want', 'looking', 'apartment', 'property', 'real', 'estate',
  'israel', 'buy', 'rent', 'sale', 'search', 'room', 'rooms',
  'דירה', 'דירת', 'נכס', 'נדלן', 'נדל"ן', 'לקנייה', 'להשכרה', 'מחפש',
  'מחפשת', 'רוצה', 'צריך', 'צריכה', 'עד', 'של', 'עם', 'כל', 'גם', 'חדרים',
])

/** Lowercased, stopword-filtered significant words from free text (numbers excluded). */
export function extractSignificantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zא-ת0-9.]+/)
    .filter(w => w.length >= 2 && !/^\d+$/.test(w) && !STOPWORDS.has(w))
}

/** True if the post text contains at least one significant word from the keyword (or the keyword has no significant words — no-op filter). */
export function matchesKeyword(postText: string, keyword: string): boolean {
  const words = extractSignificantWords(keyword)
  if (words.length === 0) return true

  // Expand with bilingual city aliases so "חיפה" also matches a post that says "Haifa".
  const city = extractCityFromText(keyword)
  const expanded = city ? [...words, ...(CITY_ALIASES[city] || [])] : words

  const lower = postText.toLowerCase()
  return expanded.some(w => lower.includes(w.toLowerCase()))
}

/** First 60 chars of a post's text — used as a dedup fingerprint. */
export function buildFingerprint(text: string): string {
  return text.substring(0, 60)
}

/** True if this post should be skipped (already seen URL or fingerprint). */
export function shouldSkipPost(
  post: { url?: string; text: string },
  seenUrls: Set<string>,
  seenFingerprints: Set<string>,
): boolean {
  if (post.url && seenUrls.has(post.url)) return true
  if (seenFingerprints.has(buildFingerprint(post.text))) return true
  return false
}

/**
 * Parse the raw string Claude returns.
 * Handles: plain JSON, ```json fenced blocks, literal "null", whitespace.
 * Returns null on any parse failure or when Claude explicitly returned null.
 */
export function parseLeadJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'null') return null
  const cleaned = trimmed.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}
