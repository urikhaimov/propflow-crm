import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildFingerprint, shouldSkipPost, parseLeadJson, extractSearchFilters, matchesKeyword, matchesExtractedLead } from '@/lib/scraper-utils'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function extractLead(text: string, source: string, apiKey: string): Promise<{ lead: any, error?: string }> {
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        system: `You are a real estate lead extraction AI for an Israeli real estate agency.
Extract leads from posts in ANY language (Hebrew, English, Russian, Arabic).
Return ONLY valid JSON or exactly the word: null
No markdown, no explanation, no code blocks.`,
        messages: [{
          role: 'user',
          content: `Does this post contain a real estate lead (someone buying, selling, renting, or investing in property)?

If YES return JSON with these exact keys:
{
  "first_name": "לא",
  "last_name": "ידוע",
  "email": null,
  "phone": null,
  "intent_type": "buyer",
  "city": "תל אביב",
  "neighborhood": "פלורנטין",
  "budget_min": 2000000,
  "budget_max": 3800000,
  "rooms": 4,
  "property_type": "apartment",
  "ai_score": 85,
  "urgency_score": 75,
  "ai_summary": "קונה מחפש 4 חדרים בתל אביב עד 3.8M",
  "tags": ["דחוף", "קנייה"],
  "source_platform": "${source}"
}

Extract first_name / last_name if the author signs their name in the post. Extract email if an email address appears. Extract phone if a phone number appears (Israeli format or international). Use null for any field not found.

Adjust all values to match the actual post content.
If NO real estate lead found: null

Post:
"""
${text.substring(0, 800)}
"""`
        }],
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      return { lead: null, error: `Anthropic ${res.status}: ${errData?.error?.message || res.statusText}` }
    }

    const data = await res.json()
    const raw = data.content?.[0]?.text?.trim() || ''
    return { lead: parseLeadJson(raw) }
  } catch (err) {
    return { lead: null, error: String(err) }
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY not set in .env.local',
      scanned: 0, extracted: 0, leads: []
    }, { status: 500 })
  }

  const body = await req.json()
  const { sources = ['manual'], keyword = 'apartment israel', manualPosts = [] } = body

  const rawPosts: Array<{ text: string; source: string; url?: string; author?: string }> = []
  const debugLog: string[] = []

  // Structured filters parsed from the search keyword — scopes Yad2/Madlan
  // instead of always pulling from 5 default major cities regardless of input.
  const filters = extractSearchFilters(keyword)
  const filterSummary = Object.entries(filters).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`).join(', ')
  if (filterSummary) debugLog.push(`keyword "${keyword}" → filters: ${filterSummary}`)

  function buildFilteredUrl(base: string, path: string): string {
    const qs = new URLSearchParams()
    if (filters.city) qs.set('city', filters.city)
    if (filters.minRooms) qs.set('minRooms', String(filters.minRooms))
    if (filters.propertyType) qs.set('propertyType', filters.propertyType)
    if (filters.maxPrice) qs.set('maxPrice', String(filters.maxPrice))
    if (filters.dealType) qs.set('dealType', filters.dealType)
    const qsStr = qs.toString()
    return qsStr ? `${base}${path}?${qsStr}` : `${base}${path}`
  }

  // ── Manual posts — always first, always all ─────────────────
  for (const post of manualPosts) {
    if (post.text?.trim()) {
      rawPosts.push({ text: post.text.trim(), source: post.source || 'manual' })
      debugLog.push(`manual post added (${post.text.length} chars)`)
    }
  }

  // ── Reddit ──────────────────────────────────────────────────
  if (sources.includes('reddit')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      debugLog.push(`fetching reddit from ${base}/api/reddit`)
      const res = await fetch(`${base}/api/reddit`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const posts = data.posts || []
        // surface per-subreddit breakdown from the reddit route
        if (data.debug?.length) data.debug.forEach((l: string) => debugLog.push(`  reddit: ${l}`))
        debugLog.push(`reddit: ${posts.length} posts after all filters`)
        for (const post of posts) {
          rawPosts.push({
            text: `${post.title}\n${post.body}`.trim(),
            source: 'reddit',
            url: post.url,
            author: post.author,
          })
        }
      } else {
        debugLog.push(`reddit fetch failed: HTTP ${res.status}`)
      }
    } catch (err) {
      debugLog.push(`reddit error: ${String(err)}`)
    }
  }

  // ── Madlan ─────────────────────────────────────────────────
  if (sources.includes('madlan')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const url = buildFilteredUrl(base, '/api/madlan')
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.debug?.length) data.debug.forEach((l: string) => debugLog.push(`  madlan: ${l}`))
        for (const post of data.posts || []) {
          rawPosts.push({ text: `${post.title}\n${post.body}`.trim(), source: 'madlan', url: post.url })
        }
        debugLog.push(`madlan returned ${data.posts?.length || 0} posts`)
      } else {
        debugLog.push(`madlan fetch failed: ${res.status}`)
      }
    } catch (err) {
      debugLog.push(`madlan error: ${String(err)}`)
    }
  }

  // ── Yad2 ───────────────────────────────────────────────────
  if (sources.includes('yad2')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const url = buildFilteredUrl(base, '/api/yad2')
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.debug?.length) data.debug.forEach((l: string) => debugLog.push(`  yad2: ${l}`))
        for (const post of data.posts || []) {
          rawPosts.push({ text: `${post.title}\n${post.body}`.trim(), source: 'yad2', url: post.url })
        }
        debugLog.push(`yad2 returned ${data.posts?.length || 0} posts`)
      } else {
        debugLog.push(`yad2 fetch failed: HTTP ${res.status}`)
      }
    } catch (err) {
      debugLog.push(`yad2 error: ${String(err)}`)
    }
  }

  // ── Telegram ────────────────────────────────────────────────
  if (sources.includes('telegram')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${base}/api/telegram`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.debug?.length) data.debug.forEach((l: string) => debugLog.push(`  telegram: ${l}`))
        for (const post of data.posts || []) {
          rawPosts.push({ text: `${post.title}\n${post.body}`.trim(), source: 'telegram', url: post.url })
        }
        debugLog.push(`telegram returned ${data.posts?.length || 0} posts`)
      } else {
        debugLog.push(`telegram fetch failed: HTTP ${res.status}`)
      }
    } catch (err) {
      debugLog.push(`telegram error: ${String(err)}`)
    }
  }

  // ── Facebook groups (local only — uses Chrome profile) ──────
  if (sources.includes('facebook')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${base}/api/facebook-groups`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.localOnly) {
          debugLog.push('facebook: requires local run — skipped on Vercel')
        } else {
          if (data.debug?.length) data.debug.forEach((l: string) => debugLog.push(`  facebook: ${l}`))
          for (const post of data.posts || []) {
            rawPosts.push({ text: `${post.title}\n${post.body}`.trim(), source: 'facebook', url: post.url })
          }
          debugLog.push(`facebook returned ${data.posts?.length || 0} posts`)
        }
      } else {
        debugLog.push(`facebook fetch failed: HTTP ${res.status}`)
      }
    } catch (err) {
      debugLog.push(`facebook error: ${String(err)}`)
    }
  }

  // ── URL scrape (Playwright, local only) ─────────────────────
  if (sources.includes('url')) {
    const urlList: string[] = body.scrapeUrls || []
    for (const scrapeUrl of urlList.slice(0, 5)) {
      try {
        const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const res = await fetch(`${base}/api/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: scrapeUrl, useProfile: false }),
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.text) {
            rawPosts.push({ text: data.text, source: 'crawler', url: scrapeUrl })
            debugLog.push(`url scraped: ${scrapeUrl.substring(0, 60)} (${data.text.length} chars)`)
          }
        } else {
          const err = await res.json().catch(() => ({}))
          debugLog.push(`url scrape failed (${scrapeUrl.substring(0, 40)}): ${(err as { message?: string }).message || `HTTP ${res.status}`}`)
        }
      } catch (err) {
        debugLog.push(`url scrape error: ${String(err)}`)
      }
    }
  }

  // ── Deduplicate crawler posts against Supabase (last 30 days) ─
  const manualCount = manualPosts.filter((p: any) => p.text?.trim()).length
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('leads')
    .select('source_url, original_post')
    .gte('created_at', cutoff)

  const seenUrls = new Set<string>((existing || []).map((l: { source_url?: string }) => l.source_url).filter((u): u is string => !!u))
  const seenFingerprints = new Set((existing || []).map((l: { original_post?: string }) => buildFingerprint(l.original_post || '')))

  // Yad2/Madlan already get precisely scoped server-side via structured Apify
  // params (city/rooms/price/dealType derived from the same keyword) — re-running
  // a loose text match on top is redundant and breaks on script mismatches (the
  // keyword's Hebrew "חיפה" won't match a listing whose city field came back as
  // English "Haifa"). Telegram posts are long, emoji-heavy, and structured
  // unpredictably per-channel — the same literal-text matching produced false
  // negatives there too (genuinely relevant listings dropped because the
  // exact search words didn't appear verbatim in the truncated body). Claude's
  // own extraction already filters for real intent at no extra correctness
  // cost, so skip the keyword pre-filter for sources we can't reliably text-match.
  const STRUCTURALLY_FILTERED_SOURCES = new Set(['yad2', 'madlan', 'telegram'])

  const crawlerPosts = rawPosts
    .slice(manualCount)
    .filter(p => {
      if (shouldSkipPost(p, seenUrls, seenFingerprints)) {
        debugLog.push(`skipped (duplicate): "${buildFingerprint(p.text)}"`)
        return false
      }
      if (!STRUCTURALLY_FILTERED_SOURCES.has(p.source) && !matchesKeyword(p.text, keyword)) {
        debugLog.push(`skipped (no keyword match): "${buildFingerprint(p.text)}"`)
        return false
      }
      return true
    })
    .slice(0, 15)

  // ── Extract with Claude ─────────────────────────────────────
  const leads = []
  const errors = []
  const seen = new Set<string>()

  const toProcess = [...rawPosts.slice(0, manualCount), ...crawlerPosts]

  debugLog.push(`processing ${toProcess.length} posts with Claude`)

  for (const post of toProcess) {
    const fp = post.text.substring(0, 60)
    if (seen.has(fp)) continue
    seen.add(fp)

    const { lead, error } = await extractLead(post.text, post.source, apiKey)

    if (error) {
      errors.push(error)
      debugLog.push(`Claude error: ${error}`)
    } else if (lead) {
      // Filter against the search's city/dealType using Claude's own normalized
      // output, not raw scraped text — manual paste is exempt since it's a
      // deliberate user action independent of the search box.
      if (post.source !== 'manual' && !matchesExtractedLead(lead as { city?: string; intent_type?: string }, filters)) {
        debugLog.push(`skipped (city/intent mismatch): ${lead.intent_type} in ${lead.city}`)
        continue
      }
      leads.push({
        ...lead,
        original_post: post.text.substring(0, 500),
        source_url: post.url,
        source_author: post.author,
      })
      debugLog.push(`extracted lead: ${lead.intent_type} in ${lead.city}`)
    } else {
      debugLog.push(`no lead found in post: "${post.text.substring(0, 40)}..."`)
    }
  }

  return NextResponse.json({
    scanned: rawPosts.length,
    extracted: leads.length,
    leads,
    debug: debugLog,
    errors: errors.length > 0 ? errors : undefined,
  })
}
