// app/api/capture/route.ts
// Public inbound lead capture — receives website form submissions
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function scoreWithClaude(lead: Record<string, unknown>, apiKey: string) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: 'You are a real estate CRM AI. Score leads and return ONLY valid JSON, no markdown.',
      messages: [{
        role: 'user',
        content: `Score this real estate lead and return JSON with exactly these keys:
{
  "ai_score": <0-100>,
  "urgency_score": <0-100>,
  "ai_summary": "<2-3 sentence Hebrew summary>",
  "ai_follow_up": "<personalized Hebrew follow-up message>",
  "tags": ["<tag1>", "<tag2>"]
}

Lead:
- Name: ${lead.first_name} ${lead.last_name}
- Phone: ${lead.phone || 'N/A'}
- Intent: ${lead.intent_type}
- City: ${lead.city || 'לא צוין'}
- Budget: ${lead.budget_min || '?'}–${lead.budget_max || '?'} ILS
- Rooms: ${lead.rooms || 'לא צוין'}
- Notes: ${lead.notes || 'N/A'}
- Source: website form`,
      }],
    }),
  })

  if (!res.ok) throw new Error('Claude error')
  const data = await res.json()
  const raw = data.content?.[0]?.text || ''
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const { first_name, last_name, phone, email, intent_type, city, budget_min, budget_max, rooms, notes } = body

  if (!first_name || !last_name || !phone) {
    return NextResponse.json({ error: 'שם ומספר טלפון הם שדות חובה' }, { status: 400 })
  }

  const leadPayload = {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    phone: phone.trim(),
    email: email?.trim() || null,
    intent_type: intent_type || 'buyer',
    city: city?.trim() || null,
    budget_min: budget_min ? Number(budget_min) : null,
    budget_max: budget_max ? Number(budget_max) : null,
    rooms: rooms ? Number(rooms) : null,
    notes: notes?.trim() || null,
    source_platform: 'website',
    status: 'new',
    ai_score: 60,
    urgency_score: 50,
    tags: [],
  }

  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert([leadPayload])
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const scored = await scoreWithClaude(leadPayload, apiKey)
      await supabase.from('leads').update({
        ai_score: scored.ai_score,
        urgency_score: scored.urgency_score,
        ai_summary: scored.ai_summary,
        ai_follow_up: scored.ai_follow_up,
        tags: scored.tags,
      }).eq('id', inserted.id)
    } catch {
      // Lead is saved — AI scoring failure is non-fatal
    }
  }

  await supabase.from('notifications').insert([{
    type: 'hot_lead',
    title: `ליד חדש מהאתר — ${first_name} ${last_name}`,
    body: `${intent_type === 'buyer' ? 'קנייה' : intent_type === 'renter' ? 'שכירות' : intent_type === 'seller' ? 'מכירה' : 'השקעה'}${city ? ` ב${city}` : ''}${budget_max ? ` • עד ₪${Number(budget_max).toLocaleString()}` : ''}`,
    lead_id: inserted.id,
    is_read: false,
  }])

  return NextResponse.json({ success: true, id: inserted.id })
}
