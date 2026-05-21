// app/api/reddit/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Strong real-estate intent signals
const INTENT_KEYWORDS = [
  'looking for apartment', 'looking to buy', 'looking to rent',
  'need apartment', 'searching for flat', 'want to buy',
  'relocating to', 'moving to israel', 'moving to tel aviv',
  'apartment available', 'for rent', 'for sale',
  'מחפש דירה', 'מחפשת דירה', 'מוכר דירה', 'דירה למכירה',
  'דירה להשכרה', 'רוצה לקנות', 'מעוניין בדירה',
  'apartment in tel aviv', 'apartment in jerusalem', 'apartment in haifa',
  'flat in israel', 'room for rent', 'studio for rent',
  'sell my apartment', 'selling apartment', 'invest in israel',
  'real estate investment israel', 'property for sale israel',
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = 50

  const results: Array<{
    id: string; title: string; body: string
    author: string; subreddit: string; url: string; created: number
  }> = []

  // Target URLs — most likely to have real leads
  const targets = [
    // r/israelrealestate — most targeted
    `https://www.reddit.com/r/israelrealestate/new.json?limit=${limit}`,
    // r/Israel filtered for housing
    `https://www.reddit.com/r/Israel/search.json?q=apartment+rent+buy+looking&restrict_sr=1&sort=new&limit=25&t=month`,
    // r/telaviv housing posts
    `https://www.reddit.com/r/telaviv/search.json?q=apartment+rent+looking+flat&restrict_sr=1&sort=new&limit=25&t=month`,
    // r/Jerusalem housing
    `https://www.reddit.com/r/Jerusalem/search.json?q=apartment+rent+looking&restrict_sr=1&sort=new&limit=20&t=month`,
    // Global search for Israel real estate
    `https://www.reddit.com/search.json?q=apartment+israel+looking+rent+buy&sort=new&limit=25&t=week`,
    `https://www.reddit.com/search.json?q=דירה+ישראל+מחפש&sort=new&limit=20&t=month`,
  ]

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 PropFlowCRM/1.0',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })
      if (!res.ok) continue

      const data = await res.json()
      const posts = data?.data?.children || []

      for (const post of posts) {
        const p = post.data
        if (!p?.title) continue
        if (results.find(r => r.id === p.id)) continue // dedupe

        const fullText = `${p.title} ${p.selftext || ''}`.toLowerCase()

        // Must match at least one strong intent signal
        const hasIntent = INTENT_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()))
        if (!hasIntent) continue

        // Must have some content (not just a title)
        const content = p.selftext?.trim() || ''
        const combinedText = `${p.title}. ${content}`.trim()
        if (combinedText.length < 20) continue

        results.push({
          id: p.id,
          title: p.title,
          body: content.substring(0, 800),
          author: p.author,
          subreddit: p.subreddit,
          url: `https://reddit.com${p.permalink}`,
          created: p.created_utc,
        })
      }
    } catch {
      continue
    }
  }

  return NextResponse.json({
    source: 'reddit',
    count: results.length,
    posts: results.slice(0, 30),
  })
}
