import { NextResponse } from 'next/server'

// Public Israeli real estate Telegram channels accessible via t.me/s/
// Note: these are news/journalism channels (Globes, TheMarker reposts), not
// classifieds — most active buy/sell/rent communities on Telegram are private
// groups requiring a join link, which this public-preview scraper can't reach.
const CHANNELS = [
  'israelrealestate',
  'nadlan_il',
  'realestate_israel',
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
}

function parsePosts(html: string, channel: string): Array<{ title: string; body: string; url: string }> {
  const posts: Array<{ title: string; body: string; url: string }> = []

  // Each message is wrapped in a <div class="tgme_widget_message ..."> block
  const articleRe = /<div class="tgme_widget_message [^"]*"[^>]*data-post="([^"]+)"[\s\S]*?<\/article>/gi
  const textRe    = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i

  let article: RegExpExecArray | null
  while ((article = articleRe.exec(html)) !== null) {
    const postId  = article[1] // e.g. "channelname/123"
    const block   = article[0]
    const textMatch = textRe.exec(block)
    if (!textMatch) continue

    const raw  = textMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
    const text = decodeHtmlEntities(raw).replace(/\s{3,}/g, '\n').trim()
    if (text.length < 15) continue

    const msgNum = postId.split('/')[1] || ''
    const url    = msgNum ? `https://t.me/${channel}/${msgNum}` : `https://t.me/s/${channel}`

    posts.push({
      title: text.split('\n')[0].substring(0, 120),
      body:  text.substring(0, 600),
      url,
    })
  }

  return posts
}

export async function GET() {
  const posts: Array<{ title: string; body: string; url: string }> = []
  const seen  = new Set<string>()
  const debug: string[] = []

  for (const channel of CHANNELS) {
    try {
      const res = await fetch(`https://t.me/s/${channel}`, {
        headers: HEADERS,
        cache: 'no-store',
      })

      // 404 = channel doesn't exist, skip silently
      if (res.status === 404) { debug.push(`@${channel}: not found`); continue }
      if (!res.ok)            { debug.push(`@${channel}: HTTP ${res.status}`); continue }

      const html     = await res.text()
      const parsed   = parsePosts(html, channel)
      let added = 0

      for (const post of parsed) {
        const fp = post.body.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)
        posts.push({ ...post, body: `[טלגרם @${channel}] ${post.body}` })
        added++
      }

      debug.push(`@${channel}: ${parsed.length} raw → ${added} added`)
    } catch (err) {
      debug.push(`@${channel}: error — ${String(err).substring(0, 60)}`)
    }
  }

  return NextResponse.json({ source: 'telegram', count: posts.length, posts, debug })
}
