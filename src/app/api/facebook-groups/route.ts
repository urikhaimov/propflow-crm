import { NextResponse } from 'next/server'

const IS_LOCAL = process.env.NODE_ENV === 'development'

// Known Israeli real estate Facebook groups
const FB_GROUPS = [
  { url: 'https://www.facebook.com/groups/nadlan.israel/',         label: 'נדלן ישראל' },
  { url: 'https://www.facebook.com/groups/israelirealestate/',     label: 'Israel Real Estate' },
  { url: 'https://www.facebook.com/groups/apartment.israel/',      label: 'דירות בישראל' },
  { url: 'https://www.facebook.com/groups/telavivrealestate/',     label: 'תל אביב נדלן' },
  { url: 'https://www.facebook.com/groups/realestate.tlv/',        label: 'נדלן TLV' },
  { url: 'https://www.facebook.com/groups/israelnachlas/',         label: 'ישראל נחלאות' },
]

export async function GET() {
  if (!IS_LOCAL) {
    return NextResponse.json({
      source: 'facebook',
      count: 0,
      posts: [],
      localOnly: true,
      debug: [
        'Facebook scraping requires local run (npm run dev).',
        'The app needs access to your Chrome browser session to log into Facebook.',
        'On Vercel this is not possible — the browser runs on their servers, not your machine.',
      ],
    })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const posts: Array<{ title: string; body: string; url: string }> = []
  const seen = new Set<string>()
  const debug: string[] = []

  for (const group of FB_GROUPS) {
    try {
      const res = await fetch(`${base}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: group.url, useProfile: true }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        debug.push(`${group.label}: ${(err as { message?: string }).message || `HTTP ${res.status}`}`)
        continue
      }

      const data = await res.json() as { text?: string }
      const text = data.text || ''

      if (!text || text.length < 50) {
        debug.push(`${group.label}: empty page`)
        continue
      }

      // Facebook shows a login wall when not authenticated — detect and skip
      const isLoginPage = (
        text.includes('Log in to Facebook') ||
        text.includes('Log In') && text.includes('Forgot account') ||
        text.includes('You must log in') ||
        text.includes('Create new account') && text.includes('Forgot password')
      )
      if (isLoginPage) {
        debug.push(`${group.label}: ⚠ פייסבוק מציג דף התחברות — Chrome לא מחובר לפייסבוק`)
        continue
      }

      // Each paragraph separated by 2+ newlines is treated as a distinct post
      const paragraphs = text
        .split(/\n{2,}/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 40 && p.length < 2_000)
        .slice(0, 25)

      let added = 0
      for (const para of paragraphs) {
        const fp = para.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)
        posts.push({
          title: para.split('\n')[0].substring(0, 120),
          body: `[פייסבוק — ${group.label}] ${para.substring(0, 600)}`,
          url: group.url,
        })
        added++
      }

      debug.push(`${group.label}: ${added} posts extracted`)
    } catch (err) {
      debug.push(`${group.label}: error — ${String(err).substring(0, 80)}`)
    }
  }

  return NextResponse.json({ source: 'facebook', count: posts.length, posts, debug })
}
