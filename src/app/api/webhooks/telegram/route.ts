// app/api/webhooks/telegram/route.ts
// Telegram Bot webhook — inbound message → lead + auto-reply
// Telegram sends POST only; security is via X-Telegram-Bot-Api-Secret-Token header
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function extractAndScore(messageText: string, apiKey: string) {
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
      system: 'You are a real estate lead extraction AI for an Israeli real estate agency. Return ONLY valid JSON or exactly the word: null. No markdown.',
      messages: [{
        role: 'user',
        content: `Extract real estate lead info from this Telegram message. Return JSON or null if not a real estate inquiry:
{
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
  "ai_follow_up": "<warm Hebrew reply to send back, max 3 sentences>",
  "tags": ["<tag>"]
}

Message: "${messageText.slice(0, 600)}"`,
      }],
    }),
  })

  if (!res.ok) throw new Error('Claude error')
  const data = await res.json()
  const raw = data.content?.[0]?.text || ''
  const clean = raw.replace(/```json|```/g, '').trim()
  if (clean === 'null') return null
  return JSON.parse(clean)
}

export async function POST(req: NextRequest) {
  // Validate secret token if configured
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== secret) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  const body = await req.json()

  // Only handle text messages
  const msg = body?.message
  if (!msg?.text) return NextResponse.json({ ok: true })

  const chatId: number = msg.chat.id
  const messageText: string = msg.text
  const from = msg.from || {}
  const first_name: string = from.first_name || 'לא'
  const last_name: string = from.last_name || 'ידוע'
  const telegramId: number = from.id

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  let extracted: Record<string, unknown> | null = null
  try {
    extracted = await extractAndScore(messageText, apiKey)
  } catch {
    extracted = null
  }

  if (!extracted) {
    await sendTelegramMessage(chatId,
      'שלום! 👋 אנחנו סוכנות נדל"ן. אם אתם מחפשים לקנות, למכור או לשכור נכס בישראל — נשמח לעזור!\n\nספרו לנו: מה אתם מחפשים, באיזה עיר ומה התקציב?'
    )
    return NextResponse.json({ ok: true })
  }

  const leadPayload = {
    first_name,
    last_name,
    // Telegram doesn't expose phone — store Telegram ID in notes
    notes: `Telegram ID: ${telegramId}`,
    source_platform: 'telegram',
    original_post: messageText.slice(0, 500),
    status: 'new',
    intent_type: extracted.intent_type || 'buyer',
    city: extracted.city || null,
    neighborhood: extracted.neighborhood || null,
    budget_min: extracted.budget_min || null,
    budget_max: extracted.budget_max || null,
    rooms: extracted.rooms || null,
    property_type: extracted.property_type || 'apartment',
    ai_score: extracted.ai_score || 60,
    urgency_score: extracted.urgency_score || 50,
    ai_summary: extracted.ai_summary || null,
    ai_follow_up: extracted.ai_follow_up || null,
    tags: extracted.tags || [],
  }

  const { data: lead } = await supabase.from('leads').insert([leadPayload]).select().single()

  const reply = (extracted.ai_follow_up as string) ||
    `שלום ${first_name}! 🏠 קיבלנו את פנייתך ונציג יחזור אליך בהקדם. תודה!`

  await sendTelegramMessage(chatId, reply)

  if (lead?.id) {
    await Promise.all([
      supabase.from('activities').insert([{
        lead_id: lead.id,
        type: 'discovery',
        content: messageText.slice(0, 300),
        metadata: { channel: 'telegram', chat_id: chatId, telegram_id: telegramId },
      }]),
      supabase.from('notifications').insert([{
        type: 'hot_lead',
        title: `הודעת Telegram חדשה — ${first_name} ${last_name}`,
        body: messageText.slice(0, 120),
        lead_id: lead.id,
        is_read: false,
      }]),
    ])
  }

  return NextResponse.json({ ok: true })
}
