'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { ScoreBar, Spinner, EmptyState } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { supabase } from '@/lib/supabase'
import { useCurrentAgent } from '@/hooks/useCurrentAgent'
import { canManageAgents } from '@/lib/auth'
import type { Agent } from '@/types'

const AGENT_COLORS = ['#6366f1', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']
const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל', senior_agent: 'סוכן בכיר', agent: 'סוכן',
  junior_agent: 'סוכן זוטר', user: 'משתמש',
}

export default function AgentsPage() {
  const router = useRouter()
  const { agents, setAgents, leads } = useCRMStore()
  const currentAgent = useCurrentAgent()
  const [loading, setLoading] = useState(true)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  async function handleSetup() {
    setSetupLoading(true)
    setSetupError('')
    const res = await fetch('/api/setup', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setSetupError(data.error || 'שגיאה')
      setSetupLoading(false)
      return
    }
    // Reload agents list, then do a full page reload so the session refreshes
    window.location.reload()
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('agents').select('*').order('created_at')
      if (!error && data) setAgents(data as Agent[])
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

  return (
    <CRMLayout>
      <Topbar
        title="ניהול סוכנים"
        action={canManageAgents(currentAgent?.role || '') ? { label: '+ סוכן חדש', onClick: () => router.push('/register') } : undefined}
      />
      <div className="flex-1 overflow-y-auto p-3 md:p-5" dir="rtl">
        {loading ? (
          <Spinner />
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">👤</div>
            <div className="text-lg font-semibold mb-2">אין סוכנים עדיין</div>
            <p className="text-slate-500 text-sm mb-6 text-center max-w-xs">
              המערכת עדיין לא אותחלה. לחצו על הכפתור כדי להגדיר את עצמכם כמנהל ראשי.
            </p>
            {setupError && (
              <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                {setupError}
              </div>
            )}
            <button
              onClick={handleSetup}
              disabled={setupLoading}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 rounded-xl font-semibold text-sm transition flex items-center gap-2"
            >
              {setupLoading
                ? <><span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> מאתחל...</>
                : '🚀 אתחל מערכת — הגדר אותי כמנהל'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {agents.map((agent, i) => {
                const stats = agentStats(agent.id)
                const color = AGENT_COLORS[i % AGENT_COLORS.length]
                const initials = agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                return (
                  <div key={agent.id} className="glass rounded-2xl p-4 hover:bg-white/5 transition">
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
                      {[
                        { val: stats.total,  label: 'לידים',  color: 'text-white' },
                        { val: stats.closed, label: 'נסגרו',  color: 'text-green-400' },
                        { val: `${stats.cvr}%`, label: 'המרה', color: '' },
                      ].map(({ val, label, color: c }) => (
                        <div key={label} className="bg-slate-800 rounded-lg p-2">
                          <div className={`text-lg font-bold ${c}`} style={!c ? { color } : {}}>{val}</div>
                          <div className="text-xs text-slate-500">{label}</div>
                        </div>
                      ))}
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

            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">ביצועי סוכנים</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-white/5">
                    {['סוכן', 'תפקיד', 'לידים', 'נסגרו', 'המרה', 'הכנסות'].map(h => (
                      <th key={h} className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent, i) => {
                    const stats = agentStats(agent.id)
                    const color = AGENT_COLORS[i % AGENT_COLORS.length]
                    return (
                      <tr key={agent.id} className="border-b border-white/3 hover:bg-white/3 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}
      </div>
    </CRMLayout>
  )
}
