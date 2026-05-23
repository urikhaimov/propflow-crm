// lib/ai.ts
// All AI calls go through /api/ai (server-side) so the key stays secret

import type { Lead, Property } from '@/types'

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!res.ok) throw new Error(`AI API error: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ─── LEAD SCORING ─────────────────────────────────────────────
export async function scoreLeadWithAI(lead: Partial<Lead>): Promise<{
  ai_score: number
  urgency_score: number
  ai_summary: string
  ai_follow_up: string
  tags: string[]
}> {
  const system = `You are a real estate CRM AI. Score leads and return ONLY valid JSON, no markdown, no explanation.`
  const user = `Analyze this real estate lead and return JSON with exactly these keys:
{
  "ai_score": <0-100 overall quality score>,
  "urgency_score": <0-100 urgency>,
  "ai_summary": "<2-3 sentence Hebrew summary>",
  "ai_follow_up": "<personalized Hebrew follow-up message>",
  "tags": ["<tag1>", "<tag2>"]
}

Lead:
- Name: ${lead.first_name} ${lead.last_name}
- Intent: ${lead.intent_type}
- City: ${lead.city} / ${lead.neighborhood}
- Budget: ${lead.budget_min}–${lead.budget_max} ILS
- Rooms: ${lead.rooms}
- Property: ${lead.property_type}
- Source: ${lead.source_platform}
- Post: ${lead.original_post || 'N/A'}
- Notes: ${(lead as any).notes || 'N/A'}`

  try {
    const raw = await callClaude(system, user)
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      ai_score: 60,
      urgency_score: 50,
      ai_summary: 'ליד חדש שהתווסף למערכת. יש לבצע בדיקה ידנית.',
      ai_follow_up: `שלום ${lead.first_name}, ראינו שאתם מחפשים נכס. נשמח לעזור! מתי נוח לכם לשיחה?`,
      tags: [lead.intent_type || 'buyer'],
    }
  }
}

// ─── PROPERTY ↔ LEAD MATCHING ─────────────────────────────────
export async function matchLeadsToProperty(
  property: Property,
  leads: Lead[]
): Promise<Array<{ lead_id: string; score: number; reason: string }>> {
  const system = `You are a real estate matching AI. Return ONLY a valid JSON array, no markdown.`
  const user = `Match these leads to the property. Return JSON array:
[{"lead_id": "<id>", "score": <0-100>, "reason": "<Hebrew explanation, max 20 words>"}]

Only include leads with score >= 60. Sort by score descending.

Property: ${property.title}, ${property.city}, ${property.rooms}BR, ${property.area}m², ₪${property.price?.toLocaleString()}

Leads:
${leads.slice(0, 10).map(l =>
  `- id:${l.id} | ${l.intent_type} | ${l.city} | ${l.rooms}BR | ₪${l.budget_min}–${l.budget_max}`
).join('\n')}`

  try {
    const raw = await callClaude(system, user)
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return []
  }
}

// ─── EXTRACT LEAD FROM POST ───────────────────────────────────
export async function extractLeadFromPost(
  postText: string,
  source: string
): Promise<Partial<Lead> | null> {
  const system = `You are a real estate lead extraction AI. Return ONLY valid JSON or the word null.`
  const user = `Extract real estate lead info from this post. Return JSON or null if not a real estate lead:
{
  "first_name": "<first name if found, else לא>",
  "last_name": "<last name if found, else ידוע>",
  "email": "<email address if found, else null>",
  "phone": "<phone number if found (Israeli or international), else null>",
  "intent_type": "buyer|seller|renter|investor",
  "city": "<city if mentioned>",
  "neighborhood": "<neighborhood if mentioned>",
  "budget_min": <number or null>,
  "budget_max": <number or null>,
  "rooms": <number or null>,
  "property_type": "apartment|villa|penthouse|studio|commercial",
  "source_platform": "${source}"
}

Post: "${postText}"`

  try {
    const raw = await callClaude(system, user)
    const clean = raw.replace(/```json|```/g, '').trim()
    if (clean === 'null') return null
    return JSON.parse(clean)
  } catch {
    return null
  }
}

// ─── AI SEARCH ────────────────────────────────────────────────
export async function aiSearchLeads(query: string, leads: Lead[]): Promise<Lead[]> {
  const system = `You are a real estate CRM search AI. Return ONLY a JSON array of matching lead IDs.`
  const user = `Query: "${query}"

Return JSON array of matching lead IDs: ["id1", "id2"]

Leads:
${leads.map(l =>
  `id:${l.id} | ${l.first_name} ${l.last_name} | ${l.intent_type} | ${l.city} | ₪${l.budget_max} | score:${l.ai_score} | ${l.status}`
).join('\n')}`

  try {
    const raw = await callClaude(system, user)
    const clean = raw.replace(/```json|```/g, '').trim()
    const ids: string[] = JSON.parse(clean)
    return leads.filter(l => ids.includes(l.id))
  } catch {
    // Fallback: basic text search
    const q = query.toLowerCase()
    return leads.filter(l =>
      `${l.first_name} ${l.last_name} ${l.city} ${l.intent_type} ${l.status}`
        .toLowerCase().includes(q)
    )
  }
}

// ─── GENERATE EMAIL ───────────────────────────────────────────
export async function generateEmail(lead: Lead, context: string): Promise<string> {
  const system = `You are a professional Israeli real estate agent. Write concise professional Hebrew emails.`
  const user = `Write a short Hebrew email to ${lead.first_name} ${lead.last_name}.
Context: ${context}
They are a ${lead.intent_type} looking in ${lead.city}, budget ₪${(lead.budget_max as number)?.toLocaleString()}, ${lead.rooms} rooms.
Keep it under 5 sentences. Start with שלום ${lead.first_name}.`

  try {
    return await callClaude(system, user)
  } catch {
    return `שלום ${lead.first_name},\n\nאנחנו שמחים לעזור לך למצוא את הנכס המושלם ב${lead.city}.\nצוות PropFlow`
  }
}
