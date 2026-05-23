// app/api/webhooks/whatsapp/route.ts
// Meta WhatsApp Cloud API webhook — inbound message → lead + auto-reply
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

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
        content: `Extract real estate lead info from this WhatsApp message. Return JSON or null if not a real estate inquiry:
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
  "ai_follow_up": "<warm Hebrew auto-reply to send back, max 3 sentences>",
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

// Webhook verification (Meta sends GET to verify endpoint)
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// Incoming message handler
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Meta sends test pings with no entry — acknowledge silently
  const entry = body?.entry?.[0]
  const changes = entry?.changes?.[0]
  const value = changes?.value
  const messages = value?.messages

  if (!messages?.length) {
    return NextResponse.json({ status: 'ok' })
  }

  const msg = messages[0]
  if (msg.type !== 'text') return NextResponse.json({ status: 'ok' })

  const from = msg.from // phone number in E.164
  const messageText = msg.text?.body || ''
  const contactName = value?.contacts?.[0]?.profile?.name || ''

  const nameParts = contactName.trim().split(' ')
  const first_name = nameParts[0] || 'לא'
  const last_name = nameParts.slice(1).join(' ') || 'ידוע'

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ status: 'ok' })

  let extracted: Record<string, unknown> | null = null
  try {
    extracted = await extractAndScore(messageText, apiKey)
  } catch {
    extracted = null
  }

  if (!extracted) {
    // Not a real estate message — send a generic reply
    await sendWhatsAppMessage(from,
      'שלום! אנחנו סוכנות נדל"ן. אם אתם מחפשים לקנות, למכור או לשכור נכס — נשמח לעזור! ספרו לנו במה אתם מעוניינים.'
    )
    return NextResponse.json({ status: 'ok' })
  }

  const leadPayload = {
    first_name,
    last_name,
    phone: from,
    source_platform: 'whatsapp',
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

  // Send AI-generated reply
  const reply = (extracted.ai_follow_up as string) ||
    `שלום ${first_name}! קיבלנו את פנייתך ונציג יחזור אליך בהקדם. תודה!`

  await sendWhatsAppMessage(from, reply)

  if (lead?.id) {
    await Promise.all([
      supabase.from('activities').insert([{
        lead_id: lead.id,
        type: 'discovery',
        content: messageText.slice(0, 300),
        metadata: { channel: 'whatsapp', from },
      }]),
      supabase.from('notifications').insert([{
        type: 'hot_lead',
        title: `הודעת WhatsApp חדשה — ${first_name} ${last_name}`,
        body: messageText.slice(0, 120),
        lead_id: lead.id,
        is_read: false,
      }]),
    ])
  }

  return NextResponse.json({ status: 'ok' })
}
