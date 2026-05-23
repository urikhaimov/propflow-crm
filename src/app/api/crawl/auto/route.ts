// app/api/crawl/auto/route.ts
// Scheduled Reddit crawl — called by Vercel Cron every 6 hours.
// GET: cron trigger (validates CRON_SECRET via Authorization header)
// POST: manual trigger from Settings page
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MIN_SCORE = 60  // only auto-save leads above this threshold
const MAX_POSTS = 15  // cost guard — same cap as manual crawl

async function extractLead(text: string, apiKey: string): Promise<Record<string, unknown> | null> {
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
Return ONLY valid JSON or exactly the word: null. No markdown.`,
      messages: [{
        role: 'user',
        content: `Does this post contain a real estate lead (someone buying, selling, renting, or investing in property in Israel)?

If YES return JSON:
{
  "first_name": "לא",
  "last_name": "ידוע",
  "email": null,
  "phone": null,
  "intent_type": "buyer|seller|renter|investor",
  "city": "<Hebrew city or null>",
  "neighborhood": "<Hebrew neighborhood or null>",
  "budget_min": <number or null>,
  "budget_max": <number or null>,
  "rooms": <number or null>,
  "property_type": "apartment|villa|penthouse|studio|commercial|land",
  "ai_score": <0-100>,
  "urgency_score": <0-100>,
  "ai_summary": "<2-3 sentence Hebrew summary>",
  "tags": ["<tag>"]
}

Extract first_name / last_name if the author signs their name. Extract email if an email address appears. Extract phone if a phone number appears (Israeli or international format). Use null for any field not found.
If NO real estate lead: null

Post:
"""
${text.substring(0, 800)}
"""`,
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

interface RawPost {
  title: string
  body: string
  url?: string
  source: string
}

async function fetchSource(url: string): Promise<RawPost[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data.posts || []).map((p: Record<string, string>) => ({
      title: p.title || '',
      body: p.body || '',
      url: p.url || '',
      source: data.source || 'crawler',
    }))
  } catch {
    return []
  }
}

async function saveLead(
  lead: Record<string, unknown>,
  post: RawPost,
): Promise<boolean> {
  const text = `${post.title}\n${post.body}`.trim()
  const { data } = await supabase.from('leads').insert([{
    first_name: lead.first_name || 'לא',
    last_name: lead.last_name || 'ידוע',
    email: lead.email || null,
    phone: lead.phone || null,
    source_platform: post.source,
    original_post: text.substring(0, 500),
    source_url: post.url || null,
    status: 'new',
    intent_type: lead.intent_type || 'buyer',
    city: lead.city || null,
    neighborhood: lead.neighborhood || null,
    budget_min: lead.budget_min || null,
    budget_max: lead.budget_max || null,
    rooms: lead.rooms || null,
    property_type: lead.property_type || 'apartment',
    ai_score: lead.ai_score || 60,
    urgency_score: lead.urgency_score || 50,
    ai_summary: lead.ai_summary || null,
    tags: lead.tags || [],
  }]).select().single()
  return !!data?.id
}

async function runCrawl(sources: string[] = ['reddit', 'alljobs', 'madlan']) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY not set', saved: 0, skipped: 0, scanned: 0 }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Fetch all sources in parallel
  const sourceMap: Record<string, string> = {
    reddit: `${base}/api/reddit`,
    alljobs: `${base}/api/alljobs`,
    madlan: `${base}/api/madlan`,
  }

  const allPosts: RawPost[] = []
  await Promise.all(
    sources.map(async s => {
      if (sourceMap[s]) {
        const posts = await fetchSource(sourceMap[s])
        allPosts.push(...posts)
      }
    })
  )

  // Load existing fingerprints from last 30 days across all sources
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('leads')
    .select('original_post')
    .in('source_platform', sources)
    .gte('created_at', cutoff)

  const seen = new Set(
    (existing || []).map((l: { original_post?: string }) => (l.original_post || '').substring(0, 60))
  )

  // Cap total posts processed per run
  const toProcess = allPosts.slice(0, MAX_POSTS)
  let saved = 0
  let skipped = 0

  for (const post of toProcess) {
    const text = `${post.title}\n${post.body}`.trim()
    const fp = text.substring(0, 60)
    if (seen.has(fp)) { skipped++; continue }
    seen.add(fp)

    const lead = await extractLead(text, apiKey)
    if (!lead || (lead.ai_score as number) < MIN_SCORE) { skipped++; continue }

    const ok = await saveLead(lead, post)
    if (ok) saved++
  }

  if (saved > 0) {
    const sourceLabel = sources.length > 1 ? sources.join(' + ') : sources[0]
    await supabase.from('notifications').insert([{
      type: 'crawler',
      title: `Crawler (${sourceLabel}): ${saved} ליד${saved > 1 ? 'ים' : ''} חד${saved > 1 ? 'שים' : 'ש'}`,
      body: `סרקנו ${toProcess.length} פוסטים, שמרנו ${saved} לידים אוטומטית (ציון ≥ ${MIN_SCORE})`,
      is_read: false,
    }])
  }

  return { saved, skipped, scanned: toProcess.length, sources }
}

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  // ?sources=reddit,alljobs  or default = all
  const srcParam = req.nextUrl.searchParams.get('sources')
  const sources = srcParam ? srcParam.split(',').map(s => s.trim()) : ['reddit', 'alljobs']
  const result = await runCrawl(sources)
  return NextResponse.json(result)
}

// Manual trigger from Settings page — body: { sources?: string[] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const sources: string[] = body.sources || ['reddit', 'alljobs', 'madlan']
  const result = await runCrawl(sources)
  return NextResponse.json(result)
}
