// app/api/google-search/route.ts
// Uses Google Custom Search JSON API — 100 free queries/day
// Setup: https://developers.google.com/custom-search/v1/overview

import { NextRequest, NextResponse } from 'next/server'

const SEARCH_QUERIES = [
  'מחפש דירה לקנייה ישראל',
  'מוכר דירה תל אביב',
  'דירה להשכרה ירושלים',
  'looking to buy apartment tel aviv',
  'apartment for rent haifa israel',
  'נדלן ישראל מחפש קונה',
  'דירה 4 חדרים תל אביב',
  'investment property israel',
]

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

  // If no Google API key, return instructions
  if (!apiKey || !searchEngineId) {
    return NextResponse.json({
      source: 'google',
      configured: false,
      message: 'Google Search not configured. Add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to .env.local',
      setup_url: 'https://developers.google.com/custom-search/v1/overview',
      posts: [],
    })
  }

  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword') || SEARCH_QUERIES[0]

  const results: Array<{
    id: string
    title: string
    body: string
    url: string
    source: string
    created: number
  }> = []
  const debug: string[] = []

  try {
    const queries = keyword
      ? [keyword]
      : [SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)],
         SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]]

    for (const q of queries) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q)}&num=10&dateRestrict=m1`

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        const errMsg = data?.error?.message || data?.error?.status || res.status
        const errStatus = data?.error?.status || ''
        if (res.status === 403 || errStatus === 'PERMISSION_DENIED') {
          return NextResponse.json({
            source: 'google',
            configured: false,
            apiError: '403 PERMISSION_DENIED',
            message: 'Custom Search JSON API is not enabled for this API key. Enable it in Google Cloud Console.',
            fix_url: 'https://console.cloud.google.com/apis/library/customsearch.googleapis.com',
            posts: [],
            debug: [`403 PERMISSION_DENIED: API not enabled in Google Cloud project`],
          })
        }
        debug.push(`query "${q}": HTTP ${res.status} — ${errMsg}`)
        continue
      }

      const items: Array<{ title: string; link: string; snippet?: string }> = data.items || []
      const totalResults = data.searchInformation?.totalResults ?? 'unknown'
      debug.push(`query "${q}": ${items.length} items (CSE total: ${totalResults})`)

      for (const item of items) {
        if (results.find(r => r.url === item.link)) continue
        results.push({
          id: Buffer.from(item.link).toString('base64').slice(0, 16),
          title: item.title,
          body: item.snippet || '',
          url: item.link,
          source: new URL(item.link).hostname,
          created: Date.now() / 1000,
        })
      }
    }

    return NextResponse.json({
      source: 'google',
      configured: true,
      count: results.length,
      posts: results,
      debug,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Google Search failed', details: String(err) },
      { status: 500 }
    )
  }
}
