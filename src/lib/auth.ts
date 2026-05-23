// lib/auth.ts — role permission helpers

export type AgentRole = 'admin' | 'senior_agent' | 'agent' | 'junior_agent' | 'user'

export const ROLE_LABELS: Record<AgentRole, string> = {
  admin:        'מנהל',
  senior_agent: 'סוכן בכיר',
  agent:        'סוכן',
  junior_agent: 'סוכן זוטר',
  user:         'משתמש',
}

export function canCreateLeads(role: string)    { return ['admin', 'senior_agent', 'agent', 'junior_agent'].includes(role) }
export function canDeleteLeads(role: string)    { return ['admin', 'senior_agent', 'agent'].includes(role) }
export function canAssignLeads(role: string)    { return ['admin', 'senior_agent'].includes(role) }
export function canManageAgents(role: string)   { return role === 'admin' }
export function canAccessSettings(role: string) { return role === 'admin' }
export function canRunDiscovery(role: string)   { return ['admin', 'senior_agent', 'agent'].includes(role) }
export function canEditProperties(role: string) { return ['admin', 'senior_agent', 'agent'].includes(role) }
