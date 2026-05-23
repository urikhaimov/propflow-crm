// app/api/webhooks/facebook/route.ts
// Facebook Lead Ads webhook — leadgen event → extract → CRM lead
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getFacebookLead, type FacebookLeadData } from '@/lib/facebook'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function scoreLeadData(lead: FacebookLeadData, apiKey: string) {
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
        content: `Score this Facebook Lead Ad submission and return JSON:
{
  "intent_type": "buyer|seller|renter|investor",
  "ai_score": <0-100>,
  "urgency_score": <0-100>,
  "ai_summary": "<2-3 sentence Hebrew summary>",
  "ai_follow_up": "<personalized Hebrew follow-up message>",
  "tags": ["<tag>"]
}

Lead:
- Name: ${lead.first_name} ${lead.last_name}
- Phone: ${lead.phone}
- City: ${lead.city || 'לא צוין'}
- Budget: ${lead.budget || 'לא צוין'}
- Intent field: ${lead.intent || 'לא צוין'}
- Notes: ${lead.notes || 'N/A'}`,
      }],
    }),
  })

  if (!res.ok) throw new Error('Claude error')
  const data = await res.json()
  const raw = data.content?.[0]?.text || ''
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

function parseBudget(budgetStr: string): { min: number | null; max: number | null } {
  if (!budgetStr) return { min: null, max: null }
  const nums = budgetStr.replace(/[^\d]/g, ' ').trim().split(/\s+/).map(Number).filter(Boolean)
  if (nums.length === 0) return { min: null, max: null }
  if (nums.length === 1) return { min: null, max: nums[0] }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

// Webhook verification
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// Leadgen event handler
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Only process leadgen events
  const entry = body?.entry?.[0]
  const change = entry?.changes?.[0]
  if (change?.field !== 'leadgen') {
    return NextResponse.json({ status: 'ok' })
  }

  const leadgenId = change?.value?.leadgen_id
  if (!leadgenId) return NextResponse.json({ status: 'ok' })

  const rawLead = await getFacebookLead(leadgenId)
  if (!rawLead) return NextResponse.json({ status: 'ok' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  const { min: budget_min, max: budget_max } = parseBudget(rawLead.budget)

  let aiFields = {
    intent_type: 'buyer' as const,
    ai_score: 65,
    urgency_score: 55,
    ai_summary: null as string | null,
    ai_follow_up: null as string | null,
    tags: [] as string[],
  }

  if (apiKey) {
    try {
      const scored = await scoreLeadData(rawLead, apiKey)
      aiFields = {
        intent_type: scored.intent_type || 'buyer',
        ai_score: scored.ai_score || 65,
        urgency_score: scored.urgency_score || 55,
        ai_summary: scored.ai_summary || null,
        ai_follow_up: scored.ai_follow_up || null,
        tags: scored.tags || [],
      }
    } catch { /* use defaults */ }
  }

  const leadPayload = {
    first_name: rawLead.first_name,
    last_name: rawLead.last_name,
    phone: rawLead.phone || null,
    email: rawLead.email || null,
    city: rawLead.city || null,
    budget_min,
    budget_max,
    notes: rawLead.notes || null,
    source_platform: 'facebook',
    status: 'new',
    ...aiFields,
  }

  const { data: lead } = await supabase.from('leads').insert([leadPayload]).select().single()

  if (lead?.id) {
    await Promise.all([
      supabase.from('activities').insert([{
        lead_id: lead.id,
        type: 'discovery',
        content: `ליד נכנס מ-Facebook Lead Ads`,
        metadata: { leadgen_id: leadgenId, channel: 'facebook' },
      }]),
      supabase.from('notifications').insert([{
        type: 'hot_lead',
        title: `ליד חדש מ-Facebook — ${rawLead.first_name} ${rawLead.last_name}`,
        body: `${rawLead.city ? `${rawLead.city} • ` : ''}${rawLead.phone || 'אין טלפון'}`,
        lead_id: lead.id,
        is_read: false,
      }]),
    ])
  }

  return NextResponse.json({ status: 'ok' })
}
