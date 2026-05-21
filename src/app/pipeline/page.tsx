'use client'
// app/pipeline/page.tsx
import { useEffect } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import LeadDetailPanel from '@/components/leads/LeadDetailPanel'
import { IntentBadge, ScoreBar, Spinner } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { getLeads, updateLead } from '@/lib/leads'
import { fmt, intentColor, statusLabel } from '@/lib/utils'
import type { LeadStatus } from '@/types'

const COLUMNS: Array<{ key: LeadStatus; label: string; color: string }> = [
  { key: 'new', label: 'חדש', color: '#6366f1' },
  { key: 'contacted', label: 'יצרנו קשר', color: '#06b6d4' },
  { key: 'qualified', label: 'מוסמך', color: '#f59e0b' },
  { key: 'negotiating', label: 'משא ומתן', color: '#f97316' },
  { key: 'won', label: 'נסגר ✓', color: '#22c55e' },
  { key: 'lost', label: 'אבד', color: '#64748b' },
]

export default function PipelinePage() {
  const { leads, setLeads, leadsLoading, setLeadsLoading, selectedLead, setSelectedLead, updateLead: storeUpdate } = useCRMStore()

  useEffect(() => {
    async function load() {
      setLeadsLoading(true)
      const data = await getLeads()
      setLeads(data)
      setLeadsLoading(false)
    }
    load()
  }, [])

  async function moveToStatus(leadId: string, status: LeadStatus) {
    await updateLead(leadId, { status })
    storeUpdate(leadId, { status })
  }

  const total = leads.reduce((s, l) => s + (l.budget_max || 0), 0)

  return (
    <CRMLayout>
      <Topbar title="פייפליין מכירות" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Pipeline value bar */}
          <div className="px-4 pt-3 pb-2 border-b border-white/5" dir="rtl">
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>שווי פייפליין כולל: <span className="text-white font-semibold">₪{(total / 1_000_000).toFixed(1)}M</span></span>
              <span>סה״כ לידים: <span className="text-white font-semibold">{leads.length}</span></span>
              <span>נסגרו: <span className="text-green-400 font-semibold">{leads.filter(l => l.status === 'won').length}</span></span>
            </div>
          </div>

          {leadsLoading ? <Spinner /> : (
            <div className="flex-1 overflow-x-auto p-4">
              <div className="flex gap-3 h-full" style={{ minWidth: `${COLUMNS.length * 220}px` }} dir="rtl">
                {COLUMNS.map(col => {
                  const colLeads = leads.filter(l => l.status === col.key)
                  const colValue = colLeads.reduce((s, l) => s + (l.budget_max || 0), 0)
                  return (
                    <div key={col.key} className="flex flex-col bg-slate-900 rounded-2xl min-w-[210px] flex-1 overflow-hidden">
                      {/* Column header */}
                      <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                          <span className="text-xs font-semibold text-slate-300">{col.label}</span>
                        </div>
                        <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-400">{colLeads.length}</span>
                      </div>
                      {colValue > 0 && (
                        <div className="px-3 py-1 text-xs text-slate-600">₪{(colValue / 1_000_000).toFixed(1)}M</div>
                      )}

                      {/* Cards */}
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {colLeads.map(l => (
                          <div key={l.id}
                            onClick={() => setSelectedLead(selectedLead?.id === l.id ? null : l)}
                            className={`bg-slate-800 rounded-xl p-3 cursor-pointer border transition ${
                              selectedLead?.id === l.id ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/5 hover:border-white/10'
                            }`}>
                            <div className="flex items-start justify-between mb-2">
                              <IntentBadge intent={l.intent_type} />
                              <span className="text-xs text-slate-500">{l.ai_score}</span>
                            </div>
                            <div className="text-sm font-medium mb-1">{l.first_name} {l.last_name}</div>
                            <div className="text-xs text-slate-500 mb-1.5">
                              {l.city} • {l.rooms ? `${l.rooms}חד׳` : ''} • {fmt(l.budget_max)}
                            </div>
                            <ScoreBar score={l.ai_score} showLabel={false} />
                            <div className="text-xs text-slate-600 mt-1.5">{l.source_platform}</div>

                            {/* Quick move buttons */}
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {COLUMNS.filter(c => c.key !== col.key).slice(0, 3).map(c => (
                                <button key={c.key} onClick={e => { e.stopPropagation(); moveToStatus(l.id, c.key) }}
                                  className="text-xs px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition">
                                  → {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {colLeads.length === 0 && (
                          <div className="text-center py-8 text-slate-700 text-xs">אין לידים</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {selectedLead && <LeadDetailPanel />}
      </div>
    </CRMLayout>
  )
}
