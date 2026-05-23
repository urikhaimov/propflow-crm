'use client'
// app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { StatCard, ScoreBar, IntentBadge, Spinner, AIBox } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { getLeads, getDashboardStats } from '@/lib/leads'
import { fmt, intentColor, scoreColor } from '@/lib/utils'
import AddLeadModal from '@/components/leads/AddLeadModal'
import type { DashboardStats } from '@/types'

const WEEK_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const MOCK_WEEK = [28, 42, 38, 61, 55, 72, 88]

export default function DashboardPage() {
  const { leads, setLeads, setLeadsLoading, leadsLoading, setSelectedLead } = useCRMStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [showAddLead, setShowAddLead] = useState(false)

  useEffect(() => {
    async function load() {
      setLeadsLoading(true)
      const [l, s] = await Promise.all([getLeads(), getDashboardStats()])
      setLeads(l)
      setStats(s as DashboardStats)
      setLeadsLoading(false)
    }
    load()
  }, [])

  const hotLeads = leads.filter(l => l.ai_score >= 80).sort((a, b) => b.ai_score - a.ai_score).slice(0, 5)
  const maxBar = Math.max(...MOCK_WEEK)

  return (
    <CRMLayout>
      <Topbar title="לוח בקרה" action={{ label: 'ליד חדש', onClick: () => setShowAddLead(true) }} />
      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} />}

      <div className="flex-1 overflow-y-auto p-3 md:p-5" dir="rtl">
        {leadsLoading ? <Spinner /> : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatCard icon="🔥" label="לידים חמים" value={stats?.hotLeads || 0} sub="+8 היום" color="#ef4444" />
              <StatCard icon="💰" label="שווי פייפליין" value={`₪${((stats?.pipelineValue || 0) / 1_000_000).toFixed(1)}M`} sub="+12% השבוע" color="#22c55e" />
              <StatCard icon="🤖" label="ממוצע ציון AI" value={stats?.avgAiScore || 0} sub="מכלל הלידים" color="#6366f1" />
              <StatCard icon="⚡" label="לידים היום" value={stats?.leadsToday || 0} sub="מ-6 מקורות" color="#f59e0b" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {/* Weekly chart */}
              <div className="glass rounded-2xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">פעילות שבועית</div>
                <div className="flex items-end gap-2 h-24">
                  {MOCK_WEEK.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-sm transition-all"
                        style={{ height: `${(v / maxBar) * 88}px`, background: i === 6 ? '#6366f1' : 'rgba(99,102,241,0.3)' }} />
                      <div className="text-xs text-slate-600">{WEEK_DAYS[i]}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-500 mt-2 text-center">384 לידים השבוע ↑23%</div>
              </div>

              {/* Hot leads */}
              <div className="glass rounded-2xl p-4 md:col-span-2">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">לידים חמים — עדיפות AI</div>
                <div className="space-y-3">
                  {hotLeads.length === 0 && <div className="text-sm text-slate-500 text-center py-4">אין לידים עדיין</div>}
                  {hotLeads.map(l => (
                    <div key={l.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/3 rounded-lg p-1.5 -m-1.5 transition"
                      onClick={() => setSelectedLead(l)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: intentColor(l.intent_type), color: '#fff' }}>
                        {l.first_name[0]}{l.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{l.first_name} {l.last_name}</span>
                          <IntentBadge intent={l.intent_type} />
                        </div>
                        <div className="text-xs text-slate-500">{l.city} • {fmt(l.budget_min)}–{fmt(l.budget_max)}</div>
                        <ScoreBar score={l.ai_score} />
                      </div>
                      <div className="text-sm font-bold" style={{ color: scoreColor(l.ai_score) }}>{l.ai_score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Intent breakdown */}
              <div className="glass rounded-2xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">פירוט כוונות</div>
                {[
                  { key: 'buyer', label: 'קונים', icon: '👤', color: '#6366f1' },
                  { key: 'seller', label: 'מוכרים', icon: '🏡', color: '#22c55e' },
                  { key: 'renter', label: 'שוכרים', icon: '🔑', color: '#f59e0b' },
                  { key: 'investor', label: 'משקיעים', icon: '💼', color: '#a855f7' },
                ].map(({ key, label, icon, color }) => {
                  const count = stats?.byIntent?.[key as keyof typeof stats.byIntent] || 0
                  const total = stats?.totalLeads || 1
                  return (
                    <div key={key} className="flex items-center gap-2 mb-2.5">
                      <span className="text-base">{icon}</span>
                      <span className="text-sm flex-1">{label}</span>
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, background: color }} />
                      </div>
                      <span className="text-xs font-semibold w-4" style={{ color }}>{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Source breakdown */}
              <div className="glass rounded-2xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">מקורות לידים</div>
                {(stats?.bySource || []).slice(0, 6).map(({ source, count }) => (
                  <div key={source} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-400 w-20 truncate">{source}</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min((count / (stats?.totalLeads || 1)) * 100 * 2, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-4">{count}</span>
                  </div>
                ))}
              </div>

              {/* AI Insight */}
              <div className="glass rounded-2xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">תובנות AI</div>
                <AIBox title="המלצת AI">
                  {leads.length === 0
                    ? 'הוסיפו לידים ראשונים כדי לקבל תובנות AI מותאמות אישית.'
                    : `זוהו ${hotLeads.length} לידים בעדיפות גבוהה היום. מומלץ לטפל בהם תוך 2 שעות לשיפור ההמרה.`}
                </AIBox>
                <div className="mt-3 space-y-2">
                  {[
                    { label: 'לידים חדשים', val: stats?.byStatus?.new || 0, color: '#6366f1' },
                    { label: 'בתהליך', val: (stats?.byStatus?.contacted || 0) + (stats?.byStatus?.qualified || 0), color: '#f59e0b' },
                    { label: 'נסגרו', val: stats?.byStatus?.won || 0, color: '#22c55e' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-semibold" style={{ color }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CRMLayout>
  )
}
