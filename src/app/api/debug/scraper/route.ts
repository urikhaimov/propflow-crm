// app/api/debug/scraper/route.ts — diagnoses each scraper component individually
import { NextResponse } from 'next/server'

const INTENT_KEYWORDS = [
  'looking for apartment', 'looking to buy', 'looking to rent',
  'need apartment', 'want to buy', 'relocating to israel',
  'moving to israel', 'moving to tel aviv', 'moving to haifa',
  'moving to jerusalem', 'apartment in israel', 'flat in israel',
  'real estate israel', 'property for sale israel',
  'invest in israel', 'sell my apartment',
  'מחפש דירה', 'מחפשת דירה', 'מוכר דירה', 'דירה למכירה',
  'דירה להשכרה', 'רוצה לקנות', 'מעוניין בדירה', 'נדלן', 'נדל"ן',
]

const SAMPLE_POST = `
Looking for a 3-4 room apartment in Tel Aviv to buy.
Budget around 3.5 million NIS. Need something in the Florentin or Neve Tzedek area.
Planning to move in 2-3 months. Anyone selling or know an agent?
`

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const apiKey = process.env.ANTHROPIC_API_KEY
  const results: Record<string, any> = {}

  // ── 1. ENV check ────────────────────────────────────────────
  results.env = {
    name: 'Environment variables',
    anthropic_key: apiKey ? `✓ set (${apiKey.substring(0, 12)}...)` : '✗ missing',
    app_url: base,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ missing',
  }

  // ── 2. Claude API ────────────────────────────────────────────
  if (!apiKey) {
    results.claude = { ok: false, error: 'ANTHROPIC_API_KEY not set' }
  } else {
    try {
      const t0 = Date.now()
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply: ok' }],
        }),
      })
      const data = await res.json()
      results.claude = {
        ok: res.ok,
        status: res.status,
        latency_ms: Date.now() - t0,
        response: data.content?.[0]?.text || null,
        error: data.error?.message || null,
      }
    } catch (err) {
      results.claude = { ok: false, error: String(err) }
    }
  }

  // ── 3. Telegram raw fetch ────────────────────────────────────
  try {
    const t0 = Date.now()
    const res = await fetch(`${base}/api/telegram`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'PropFlowCRM-debug/1.0' },
    })
    if (res.ok) {
      const data = await res.json()
      const posts = data.posts || []
      results.telegram = {
        ok: true,
        latency_ms: Date.now() - t0,
        posts_returned: posts.length,
        sample_titles: posts.slice(0, 3).map((p: any) => p.title?.substring(0, 80)),
        debug: data.debug || [],
      }
    } else {
      results.telegram = { ok: false, status: res.status, error: await res.text().catch(() => '') }
    }
  } catch (err) {
    results.telegram = { ok: false, error: String(err) }
  }

  // ── 4. Telegram intent-filter simulation ────────────────────
  if (results.telegram?.ok && results.telegram?.sample_titles) {
    // Re-fetch to get full text for filter test
    try {
      const res = await fetch(`${base}/api/telegram`, { cache: 'no-store' })
      const data = await res.json()
      const posts = data.posts || []
      const passing = posts.filter((p: any) => {
        const full = `${p.title} ${p.body || ''}`.toLowerCase()
        return INTENT_KEYWORDS.some(kw => full.includes(kw.toLowerCase()))
      })
      results.intent_filter = {
        total_posts: posts.length,
        passing_filter: passing.length,
        sample_passing: passing.slice(0, 2).map((p: any) => ({
          title: p.title?.substring(0, 80),
        })),
        note: passing.length === 0
          ? 'No posts match intent keywords right now — this is normal if the channels are quiet'
          : null,
      }
    } catch {
      results.intent_filter = { error: 'Could not re-fetch for filter test' }
    }
  }

  // ── 5. Claude extraction on sample post ──────────────────────
  if (apiKey && results.claude?.ok) {
    try {
      const t0 = Date.now()
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 500,
          system: 'You are a real estate lead extraction AI. Return ONLY valid JSON or exactly null.',
          messages: [{
            role: 'user',
            content: `Extract lead from this post. Return JSON or null:\n\n"""${SAMPLE_POST}"""`,
          }],
        }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text?.trim() || ''
      let parsed = null
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch {}
      results.extraction = {
        ok: !!parsed,
        latency_ms: Date.now() - t0,
        sample_post: SAMPLE_POST.trim(),
        raw_response: raw.substring(0, 300),
        parsed_lead: parsed,
        error: parsed ? null : 'Claude returned null or unparseable JSON — check prompt',
      }
    } catch (err) {
      results.extraction = { ok: false, error: String(err) }
    }
  }

  // ── 6. Full crawl on manual post (end-to-end) ─────────────────
  if (apiKey) {
    try {
      const t0 = Date.now()
      const res = await fetch(`${base}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: ['manual'],
          keyword: 'test',
          manualPosts: [{ text: SAMPLE_POST, source: 'facebook' }],
        }),
        cache: 'no-store',
      })
      const data = await res.json()
      results.end_to_end = {
        ok: data.extracted > 0,
        latency_ms: Date.now() - t0,
        scanned: data.scanned,
        extracted: data.extracted,
        lead: data.leads?.[0] || null,
        debug_log: data.debug || [],
        errors: data.errors || [],
      }
    } catch (err) {
      results.end_to_end = { ok: false, error: String(err) }
    }
  }

  const allOk = results.claude?.ok && results.telegram?.ok && results.end_to_end?.ok
  return NextResponse.json({ ok: allOk, tests: results })
}
