// app/api/crawl/route.ts
import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function extractLead(text: string, source: string, apiKey: string) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `You are a real estate lead extraction AI for an Israeli real estate agency.
Extract leads from posts in ANY language (Hebrew, English, Russian, Arabic).
Return ONLY valid JSON or exactly the word: null
No markdown, no explanation, no code blocks.`,
      messages: [{
        role: 'user',
        content: `Does this post contain a real estate lead (someone buying, selling, renting, or investing in property)?

If YES return JSON:
{
  "first_name": "<name if found, else לא>",
  "last_name": "<last name if found, else ידוע>",
  "intent_type": "buyer|seller|renter|investor",
  "city": "<city in Hebrew if mentioned, else null>",
  "neighborhood": "<neighborhood in Hebrew if mentioned, else null>",
  "budget_min": <number in ILS or null>,
  "budget_max": <number in ILS or null>,
  "rooms": <number or null>,
  "property_type": "apartment|villa|penthouse|studio|commercial",
  "ai_score": <0-100, quality of lead>,
  "urgency_score": <0-100, how urgent>,
  "ai_summary": "<1-2 sentences in Hebrew describing this lead>",
  "tags": ["tag1", "tag2"],
  "source_platform": "${source}"
}

If NO real estate lead: null

Post: """
${text.substring(0, 800)}
"""`
      }],
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const raw = data.content?.[0]?.text?.trim() || ''
  if (!raw || raw === 'null') return null
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const body = await req.json()
  const { sources = ['reddit'], keyword = 'apartment israel', manualPosts = [] } = body

  const rawPosts: Array<{ text: string; source: string; url?: string; author?: string }> = []

  // ── Manual posts first (always process these) ──────────────
  for (const post of manualPosts) {
    if (post.text?.trim()) {
      rawPosts.push({
        text: post.text.trim(),
        source: post.source || 'manual',
        url: post.url,
      })
    }
  }

  // ── Reddit ─────────────────────────────────────────────────
  if (sources.includes('reddit')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${base}/api/reddit`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        for (const post of data.posts || []) {
          rawPosts.push({
            text: `${post.title}\n${post.body}`.trim(),
            source: 'reddit',
            url: post.url,
            author: post.author,
          })
        }
      }
    } catch { /* skip */ }
  }

  // ── Google Search ──────────────────────────────────────────
  if (sources.includes('google')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(
        `${base}/api/google-search?keyword=${encodeURIComponent(keyword)}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.configured) {
          for (const post of data.posts || []) {
            rawPosts.push({
              text: `${post.title}\n${post.body}`.trim(),
              source: 'google',
              url: post.url,
            })
          }
        }
      }
    } catch { /* skip */ }
  }

  // ── Extract with Claude ────────────────────────────────────
  const leads = []
  const seen = new Set<string>()

  // Always process manual posts, then up to 15 from crawlers
  const manualCount = manualPosts.length
  const crawlerPosts = rawPosts.slice(manualCount, manualCount + 15)
  const toProcess = [...rawPosts.slice(0, manualCount), ...crawlerPosts]

  for (const post of toProcess) {
    const fp = post.text.substring(0, 60)
    if (seen.has(fp)) continue
    seen.add(fp)

    const lead = await extractLead(post.text, post.source, apiKey)
    if (lead) {
      leads.push({
        ...lead,
        original_post: post.text.substring(0, 500),
        source_url: post.url,
        source_author: post.author,
      })
    }
  }

  return NextResponse.json({
    scanned: rawPosts.length,
    extracted: leads.length,
    leads,
  })
}
