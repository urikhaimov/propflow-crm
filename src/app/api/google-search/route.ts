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

  try {
    // Run 2 searches to maximize results within free quota
    const queries = keyword
      ? [keyword]
      : [SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)],
         SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]]

    for (const q of queries) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(q)}&num=10&dateRestrict=m1`

      const res = await fetch(url)
      if (!res.ok) continue

      const data = await res.json()
      const items = data.items || []

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
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Google Search failed', details: String(err) },
      { status: 500 }
    )
  }
}
