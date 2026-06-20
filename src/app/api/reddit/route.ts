import { NextResponse } from 'next/server'
import { hasIsraelSignal } from '@/lib/scraper-utils'

export async function GET() {
  const limit = 50
  const debug: string[] = []

  const results: Array<{
    id: string; title: string; body: string
    author: string; subreddit: string; url: string; created: number
  }> = []

  // skipIsraelFilter=true for subreddit-specific searches (already geo-targeted)
  const targets = [
    // ── Israel real-estate subreddit — all posts are relevant ──────────────
    { url: `https://www.reddit.com/r/israelrealestate/new.json?limit=${limit}`, skipIsrael: true },
    // ── Aliyah — people asking about housing when moving to Israel ──────────
    { url: `https://www.reddit.com/r/aliyah/search.json?q=apartment+rent+buy+housing&restrict_sr=1&sort=new&limit=30&t=month`, skipIsrael: true },
    { url: `https://www.reddit.com/r/aliyah/search.json?q=דירה+שכירות+נדלן&restrict_sr=1&sort=new&limit=20&t=month`, skipIsrael: true },
    // ── Israel general — real estate posts ────────────────────────────────
    { url: `https://www.reddit.com/r/Israel/search.json?q=apartment+rent+buy+property&restrict_sr=1&sort=new&limit=30&t=month`, skipIsrael: true },
    { url: `https://www.reddit.com/r/Israel/search.json?q=דירה+שכירות+קנייה&restrict_sr=1&sort=new&limit=20&t=month`, skipIsrael: true },
    // ── City subreddits ────────────────────────────────────────────────────
    { url: `https://www.reddit.com/r/telaviv/search.json?q=apartment+rent+room+flat&restrict_sr=1&sort=new&limit=25&t=month`, skipIsrael: true },
    { url: `https://www.reddit.com/r/Jerusalem/search.json?q=apartment+rent+room&restrict_sr=1&sort=new&limit=20&t=month`, skipIsrael: true },
    // ── Global searches — keep Israel signal filter ────────────────────────
    { url: `https://www.reddit.com/search.json?q=apartment+israel+rent+buy&sort=new&limit=30&t=week`, skipIsrael: false },
    { url: `https://www.reddit.com/search.json?q=looking+for+apartment+tel+aviv+jerusalem+haifa&sort=new&limit=25&t=week`, skipIsrael: false },
    { url: `https://www.reddit.com/search.json?q=דירה+ישראל+מחפש+להשכיר&sort=new&limit=25&t=week`, skipIsrael: false },
    { url: `https://www.reddit.com/search.json?q=real+estate+israel+buy+sell&sort=new&limit=25&t=week`, skipIsrael: false },
  ]

  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PropFlowCRM/1.0)',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })

      if (!res.ok) {
        const subLabel = target.url.split('/r/')[1]?.split('/')[0] || 'global'
        debug.push(`r/${subLabel}: HTTP ${res.status}`)
        continue
      }

      const data = await res.json()
      const posts = data?.data?.children || []
      let added = 0

      for (const post of posts) {
        const p = post.data
        if (!p?.title) continue
        if (results.find(r => r.id === p.id)) continue  // global dedup

        const fullText = `${p.title} ${p.selftext || ''}`

        // For global (non-subreddit) searches, require an Israel signal
        if (!target.skipIsrael && !hasIsraelSignal(fullText)) continue

        const content = p.selftext?.trim() || ''
        const combinedText = `${p.title}. ${content}`.trim()
        // Accept title-only posts (caravans, quick listings often have no body)
        if (combinedText.length < 10) continue

        results.push({
          id: p.id,
          title: p.title,
          body: content.substring(0, 800),
          author: p.author,
          subreddit: p.subreddit,
          url: `https://reddit.com${p.permalink}`,
          created: p.created_utc,
        })
        added++
      }

      const subLabel = target.url.split('/r/')[1]?.split('/')[0] || 'global'
      debug.push(`r/${subLabel}: ${posts.length} raw → ${added} added`)
    } catch (err) {
      const subLabel = target.url.split('/r/')[1]?.split('/')[0] || 'global'
      debug.push(`r/${subLabel}: error — ${String(err).substring(0, 60)}`)
    }
  }

  if (results.length === 0) {
    debug.push('reddit: 0 posts — Reddit returns HTTP 403 for cloud/datacenter IPs (Vercel included)')
  }

  return NextResponse.json({
    source: 'reddit',
    count: results.length,
    posts: results.slice(0, 40),
    debug,
  })
}
