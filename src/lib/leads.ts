// lib/leads.ts
import { supabase } from './supabase'
import type { Lead, LeadFilters } from '@/types'

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  let q = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.intent_type) q = q.eq('intent_type', filters.intent_type)
  if (filters.city) q = q.ilike('city', `%${filters.city}%`)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.source_platform) q = q.eq('source_platform', filters.source_platform)
  if (filters.search) {
    q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data || []) as Lead[]
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Lead
}

export async function createLead(lead: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert([lead]).select().single()
  if (error) throw error
  return data as Lead
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

export async function getDashboardStats() {
  const { data: leads } = await supabase.from('leads').select('*')

  const all = leads || []
  const today = new Date().toISOString().split('T')[0]

  return {
    totalLeads: all.length,
    hotLeads: all.filter((l: any) => (l.ai_score ?? l.lead_score ?? 0) >= 80).length,
    pipelineValue: all.reduce((s: number, l: any) => s + (l.budget_max ?? l.budget ?? 0), 0),
    avgAiScore: all.length
      ? Math.round(all.reduce((s: number, l: any) => s + (l.ai_score ?? l.lead_score ?? 50), 0) / all.length)
      : 0,
    leadsToday: all.filter((l: any) => l.created_at?.startsWith(today)).length,
    byIntent: {
      buyer:    all.filter((l: any) => l.intent_type === 'buyer').length,
      seller:   all.filter((l: any) => l.intent_type === 'seller').length,
      renter:   all.filter((l: any) => l.intent_type === 'renter').length,
      investor: all.filter((l: any) => l.intent_type === 'investor').length,
    },
    byStatus: {
      new:         all.filter((l: any) => l.status === 'new').length,
      contacted:   all.filter((l: any) => l.status === 'contacted').length,
      qualified:   all.filter((l: any) => l.status === 'qualified').length,
      negotiating: all.filter((l: any) => l.status === 'negotiating').length,
      won:         all.filter((l: any) => l.status === 'won').length,
      lost:        all.filter((l: any) => l.status === 'lost').length,
    },
    bySource: Object.entries(
      all.reduce((acc: Record<string, number>, l: any) => {
        const s = l.source_platform || l.source || 'manual'
        acc[s] = (acc[s] || 0) + 1
        return acc
      }, {})
    ).map(([source, count]) => ({ source, count })).sort((a, b) => (b.count as number) - (a.count as number)),
  }
}
