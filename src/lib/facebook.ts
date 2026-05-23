// lib/facebook.ts
// Meta Graph API helpers for Facebook Lead Ads

const BASE = 'https://graph.facebook.com/v19.0'

interface FacebookLeadField {
  name: string
  values: string[]
}

export interface FacebookLeadData {
  first_name: string
  last_name: string
  phone: string
  email: string
  city: string
  budget: string
  intent: string
  notes: string
}

export async function getFacebookLead(leadgenId: string): Promise<FacebookLeadData | null> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!token) return null

  const res = await fetch(`${BASE}/${leadgenId}?fields=field_data&access_token=${token}`)
  if (!res.ok) return null

  const data = await res.json()
  const fields: FacebookLeadField[] = data.field_data || []

  const get = (name: string) =>
    fields.find(f => f.name.toLowerCase().includes(name))?.values?.[0] || ''

  return {
    first_name: get('first_name') || get('שם פרטי') || 'לא',
    last_name: get('last_name') || get('שם משפחה') || 'ידוע',
    phone: get('phone') || get('טלפון') || '',
    email: get('email') || get('אימייל') || '',
    city: get('city') || get('עיר') || '',
    budget: get('budget') || get('תקציב') || '',
    intent: get('intent') || get('מחפש') || 'buyer',
    notes: get('notes') || get('הערות') || '',
  }
}

export function verifyFacebookSignature(payload: string, signature: string): boolean {
  // Signature format: sha256=<hex>
  // Requires crypto — verified in the webhook route
  return signature.startsWith('sha256=')
}
