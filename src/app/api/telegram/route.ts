import { NextResponse } from 'next/server'
import { getTelegramClient, telegramConfigured } from '@/lib/telegram-client'

// MTProto connect + multi-channel fetch can take a few seconds — give it room.
export const maxDuration = 60

// Public Israeli real estate Telegram channels.
// menivimnet/jeremy_public are actual listing feeds (commercial sales / Tel
// Aviv rentals) with structured price/rooms/address/phone — high lead yield,
// listed first so they get priority within the downstream post cap.
// israelrealestate/nadlan_il/realestate_israel are news/journalism (Globes,
// TheMarker reposts) — low lead yield but functional, listed last.
const CHANNELS = [
  'menivimnet',
  'jeremy_public',
  'israelrealestate',
  'nadlan_il',
  'realestate_israel',
]

type Post = { title: string; body: string; url: string }

// ── MTProto path (authenticated user session — works on Vercel) ─────────────
// Reads recent channel history directly over Telegram's protocol. Not
// IP-blocked the way the public t.me/s/ HTML preview is.
async function fetchViaMTProto(): Promise<{ posts: Post[]; debug: string[] }> {
  const posts: Post[] = []
  const seen = new Set<string>()
  const debug: string[] = []

  const client = await getTelegramClient()

  for (const channel of CHANNELS) {
    try {
      const messages = await client.getMessages(channel, { limit: 30 })
      let added = 0

      for (const msg of messages) {
        const text = (msg.message || '').trim()
        if (text.length < 15) continue

        const fp = text.substring(0, 60)
        if (seen.has(fp)) continue
        seen.add(fp)

        posts.push({
          title: text.split('\n')[0].substring(0, 120),
          body: `[טלגרם @${channel}] ${text.substring(0, 600)}`,
          url: `https://t.me/${channel}/${msg.id}`,
        })
        added++
      }

      debug.push(`@${channel}: ${messages.length} raw → ${added} added`)
    } catch (err) {
      debug.push(`@${channel}: error — ${String(err).substring(0, 80)}`)
    }
  }

  return { posts, debug }
}

// ── HTML preview fallback (t.me/s/ — IP-blocked on datacenter IPs) ───────────
const HTML_HEADERS = {
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

function parsePosts(html: string, channel: string): Post[] {
  const posts: Post[] = []

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

async function fetchViaHtml(): Promise<{ posts: Post[]; debug: string[] }> {
  const posts: Post[] = []
  const seen  = new Set<string>()
  const debug: string[] = []

  for (const channel of CHANNELS) {
    try {
      const res = await fetch(`https://t.me/s/${channel}`, {
        headers: HTML_HEADERS,
        cache: 'no-store',
      })

      if (res.status === 404) { debug.push(`@${channel}: not found`); continue }
      if (!res.ok)            { debug.push(`@${channel}: HTTP ${res.status}`); continue }

      const parsed = parsePosts(await res.text(), channel)
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

  return { posts, debug }
}

export async function GET() {
  const debug: string[] = []

  // Prefer MTProto when configured — it works on Vercel and reads full history.
  if (telegramConfigured()) {
    try {
      const { posts, debug: d } = await fetchViaMTProto()
      debug.push('telegram: using MTProto (authenticated user session)')
      debug.push(...d)
      if (posts.length > 0) {
        return NextResponse.json({ source: 'telegram', count: posts.length, posts, debug })
      }
      debug.push('telegram: MTProto returned 0 posts — falling back to public preview')
    } catch (err) {
      debug.push(`telegram MTProto error: ${String(err).substring(0, 100)} — falling back to public preview`)
    }
  } else {
    debug.push('telegram: MTProto not configured (set TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION) — using public preview')
  }

  // Fallback: scrape the public t.me/s/ preview (works locally, blocked on Vercel).
  const { posts, debug: d } = await fetchViaHtml()
  debug.push(...d)
  if (posts.length === 0) {
    debug.push('telegram: 0 posts — public preview blocked/rate-limited on this IP. Configure MTProto for Vercel.')
  }

  return NextResponse.json({ source: 'telegram', count: posts.length, posts, debug })
}
