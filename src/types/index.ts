// types/index.ts

export type IntentType = 'buyer' | 'seller' | 'renter' | 'investor'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiating' | 'won' | 'lost'
export type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented'
export type AgentRole = 'admin' | 'senior_agent' | 'agent' | 'junior_agent'
export type PropertyType = 'apartment' | 'villa' | 'penthouse' | 'studio' | 'commercial' | 'land'

export interface Agent {
  id: string
  name: string
  email: string
  phone?: string
  role: AgentRole
  avatar_url?: string
  is_active: boolean
  created_at: string
}

export interface Lead {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  source_platform: string
  original_post?: string
  source_url?: string
  intent_type: IntentType
  city?: string
  neighborhood?: string
  budget_min?: number
  budget_max?: number
  rooms?: number
  property_type: PropertyType
  urgency_score: number
  ai_score: number
  ai_summary?: string
  ai_follow_up?: string
  status: LeadStatus
  tags: string[]
  notes?: string
  assigned_agent_id?: string
  lead_score?: number
  created_at: string
  updated_at: string
  // joined
  agent?: Agent
}

export interface Property {
  id: string
  title: string
  address?: string
  city?: string
  neighborhood?: string
  rooms?: number
  area?: number
  floor?: number
  total_floors?: number
  price?: number
  is_rental: boolean
  property_type: PropertyType
  status: PropertyStatus
  description?: string
  images: string[]
  owner_name?: string
  owner_phone?: string
  listing_source?: string
  created_at: string
  updated_at: string
}

export interface LeadPropertyMatch {
  id: string
  lead_id: string
  property_id: string
  match_score: number
  match_reason?: string
  created_at: string
  lead?: Lead
  property?: Property
}

export interface Activity {
  id: string
  lead_id?: string
  property_id?: string
  agent_id?: string
  type: 'note' | 'call' | 'email' | 'status_change' | 'match' | 'discovery'
  content?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Notification {
  id: string
  agent_id: string
  type: 'hot_lead' | 'match' | 'seller' | 'crawler' | 'system'
  title: string
  body?: string
  lead_id?: string
  property_id?: string
  is_read: boolean
  created_at: string
}

export interface SavedSearch {
  id: string
  agent_id: string
  name: string
  filters: LeadFilters
  alert_enabled: boolean
  created_at: string
}

export interface LeadFilters {
  intent_type?: IntentType | ''
  city?: string
  status?: LeadStatus | ''
  min_score?: number
  source_platform?: string
  search?: string
}

export interface DashboardStats {
  totalLeads: number
  hotLeads: number
  pipelineValue: number
  avgAiScore: number
  leadsToday: number
  byIntent: Record<IntentType, number>
  byStatus: Record<LeadStatus, number>
  bySource: Array<{ source: string; count: number }>
}

export interface CrawlerSource {
  name: string
  key: string
  status: 'active' | 'idle' | 'error'
  found: number
  progress: number
  emoji: string
}

export interface AIMatchResult {
  lead: Lead
  property: Property
  score: number
  reason: string
}
