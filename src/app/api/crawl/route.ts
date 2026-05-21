// app/api/crawl/route.ts
import { NextRequest, NextResponse } from 'next/server'

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

    if (!raw || raw === 'null') return { lead: null }

    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return { lead: parsed }
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
        debugLog.push(`reddit returned ${posts.length} posts`)
        for (const post of posts) {
          rawPosts.push({
            text: `${post.title}\n${post.body}`.trim(),
            source: 'reddit',
            url: post.url,
            author: post.author,
          })
        }
      } else {
        debugLog.push(`reddit fetch failed: ${res.status}`)
      }
    } catch (err) {
      debugLog.push(`reddit error: ${String(err)}`)
    }
  }

  // ── Google ──────────────────────────────────────────────────
  if (sources.includes('google')) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${base}/api/google-search?keyword=${encodeURIComponent(keyword)}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.configured) {
          for (const post of data.posts || []) {
            rawPosts.push({ text: `${post.title}\n${post.body}`.trim(), source: 'google', url: post.url })
          }
          debugLog.push(`google returned ${data.posts?.length || 0} posts`)
        } else {
          debugLog.push('google not configured — skipped')
        }
      }
    } catch (err) {
      debugLog.push(`google error: ${String(err)}`)
    }
  }

  // ── Extract with Claude ─────────────────────────────────────
  const leads = []
  const errors = []
  const seen = new Set<string>()

  const manualCount = manualPosts.filter((p: any) => p.text?.trim()).length
  const crawlerPosts = rawPosts.slice(manualCount, manualCount + 15)
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
