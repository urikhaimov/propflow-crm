'use client'
// app/agents/page.tsx
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { ScoreBar } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/types'

const AGENT_COLORS = ['#6366f1', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']
const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל', senior_agent: 'סוכן בכיר', agent: 'סוכן',
  junior_agent: 'סוכן זוטר', user: 'משתמש'
}

// Fallback mock agents if no agents/agencies table found
const MOCK_AGENTS: Agent[] = [
  { id: '1', name: 'דנה לוי',    email: 'dana@propflow.co.il',  role: 'senior_agent', is_active: true, created_at: '' },
  { id: '2', name: 'יואב בן',    email: 'yoav@propflow.co.il',  role: 'agent',        is_active: true, created_at: '' },
  { id: '3', name: 'שירה טל',    email: 'shira@propflow.co.il', role: 'senior_agent', is_active: true, created_at: '' },
  { id: '4', name: 'עידו אברהם', email: 'ido@propflow.co.il',   role: 'junior_agent', is_active: true, created_at: '' },
]

export default function AgentsPage() {
  const { agents, setAgents, leads } = useCRMStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Try 'agents' table first, then 'agencies', then fall back to mock
      let data: Agent[] | null = null

      const { data: agentsData, error: agentsError } = await supabase
        .from('agents').select('*').order('created_at')
      if (!agentsError && agentsData?.length) {
        data = agentsData as Agent[]
      }

      if (!data) {
        const { data: agenciesData, error: agenciesError } = await supabase
          .from('agencies').select('*').order('created_at')
        if (!agenciesError && agenciesData?.length) {
          // Map agencies columns to Agent shape
          data = agenciesData.map((a: any) => ({
            id: a.id,
            name: a.name || a.agency_name || 'סוכן',
            email: a.email || '',
            phone: a.phone,
            role: a.role || 'agent',
            is_active: a.is_active ?? true,
            created_at: a.created_at,
          }))
        }
      }

      setAgents(data || MOCK_AGENTS)
      setLoading(false)
    }
    load()
  }, [])

  function agentStats(agentId: string) {
    const agentLeads = leads.filter(l => l.assigned_agent_id === agentId)
    const closed = agentLeads.filter(l => l.status === 'won').length
    const cvr = agentLeads.length ? Math.round((closed / agentLeads.length) * 100) : 0
    const revenue = agentLeads.filter(l => l.status === 'won')
      .reduce((s, l) => s + ((l.budget_max as number) || 0), 0)
    return { total: agentLeads.length, closed, cvr, revenue }
  }

  const displayAgents = agents.length > 0 ? agents : MOCK_AGENTS

  return (
    <CRMLayout>
      <Topbar title="ניהול סוכנים" action={{ label: 'סוכן חדש', onClick: () => alert('בקרוב') }} />
      <div className="flex-1 overflow-y-auto p-5" dir="rtl">

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Agent cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {displayAgents.map((agent, i) => {
                const stats = agentStats(agent.id)
                const color = AGENT_COLORS[i % AGENT_COLORS.length]
                const initials = agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                return (
                  <div key={agent.id} className="glass rounded-2xl p-4 hover:bg-white/5 transition cursor-pointer">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: color, color: '#fff' }}>
                        {initials}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{agent.name}</div>
                        <div className="text-xs text-slate-500">{ROLE_LABELS[agent.role] || agent.role}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-slate-800 rounded-lg p-2">
                        <div className="text-lg font-bold">{stats.total}</div>
                        <div className="text-xs text-slate-500">לידים</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-2">
                        <div className="text-lg font-bold text-green-400">{stats.closed}</div>
                        <div className="text-xs text-slate-500">נסגרו</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-2">
                        <div className="text-lg font-bold" style={{ color }}>{stats.cvr}%</div>
                        <div className="text-xs text-slate-500">המרה</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mb-1">
                      הכנסות: <span className="text-white font-medium">₪{(stats.revenue / 1_000_000).toFixed(1)}M</span>
                    </div>
                    <ScoreBar score={Math.max(stats.cvr, 5)} showLabel={false} />
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <span className="text-xs text-slate-500 truncate">{agent.email}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Agent performance table */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                ביצועי סוכנים
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['סוכן', 'תפקיד', 'לידים', 'נסגרו', 'המרה', 'הכנסות', 'ציון ממוצע'].map(h => (
                      <th key={h} className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayAgents.map((agent, i) => {
                    const stats = agentStats(agent.id)
                    const color = AGENT_COLORS[i % AGENT_COLORS.length]
                    return (
                      <tr key={agent.id} className="border-b border-white/3 hover:bg-white/3 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: color, color: '#fff' }}>
                              {agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="font-medium">{agent.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{ROLE_LABELS[agent.role] || agent.role}</td>
                        <td className="px-4 py-3 font-semibold">{stats.total}</td>
                        <td className="px-4 py-3 font-semibold text-green-400">{stats.closed}</td>
                        <td className="px-4 py-3">
                          <span style={{ color: stats.cvr > 50 ? '#22c55e' : '#f59e0b' }}>{stats.cvr}%</span>
                        </td>
                        <td className="px-4 py-3 font-medium">₪{(stats.revenue / 1_000_000).toFixed(1)}M</td>
                        <td className="px-4 py-3 font-semibold" style={{ color }}>—</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </CRMLayout>
  )
}
