'use client'
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import LeadDetailPanel from '@/components/leads/LeadDetailPanel'
import AddLeadModal from '@/components/leads/AddLeadModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { IntentBadge, StatusBadge, ScoreBar, Avatar, Spinner, EmptyState } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { getLeads, deleteLead } from '@/lib/leads'
import { fmt, intentColor } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useCurrentAgent } from '@/hooks/useCurrentAgent'
import { canCreateLeads, canDeleteLeads } from '@/lib/auth'
import type { IntentType, LeadStatus } from '@/types'

const INTENT_OPTS: Array<IntentType | ''> = ['', 'buyer', 'seller', 'renter', 'investor']
const STATUS_OPTS: Array<LeadStatus | ''> = ['', 'new', 'contacted', 'qualified', 'negotiating', 'won', 'lost']
const SORT_OPTS = ['ai_score', 'urgency_score', 'created_at', 'budget_max']

export default function LeadsPage() {
  const { leads, setLeads, leadsLoading, setLeadsLoading, selectedLead, setSelectedLead, removeLead, searchQuery } = useCRMStore()
  const currentAgent = useCurrentAgent()
  const role = currentAgent?.role || 'agent'
  const [showAdd, setShowAdd] = useState(false)
  const [intentFilter, setIntentFilter] = useState<IntentType | ''>('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy, setSortBy] = useState('ai_score')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLeadsLoading(true)
      const data = await getLeads()
      setLeads(data)
      setLeadsLoading(false)
    }
    load()
  }, [])

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDeleteId(id)
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return
    try {
      await deleteLead(confirmDeleteId)
      removeLead(confirmDeleteId)
      toast.success('הליד נמחק בהצלחה')
    } catch {
      toast.error('שגיאה במחיקת הליד')
    } finally {
      setConfirmDeleteId(null)
    }
  }

  let filtered = leads
  if (intentFilter) filtered = filtered.filter(l => l.intent_type === intentFilter)
  if (statusFilter) filtered = filtered.filter(l => l.status === statusFilter)
  if (cityFilter) filtered = filtered.filter(l => l.city?.toLowerCase().includes(cityFilter.toLowerCase()))
  if (searchQuery) filtered = filtered.filter(l =>
    `${l.first_name} ${l.last_name} ${l.city} ${l.email} ${l.phone}`.toLowerCase().includes(searchQuery.toLowerCase())
  )
  filtered = [...filtered].sort((a, b) => (b[sortBy as keyof typeof b] as number) - (a[sortBy as keyof typeof a] as number))

  const intentLabels: Record<string, string> = { '': 'כל הכוונות', buyer: 'קונים', seller: 'מוכרים', renter: 'שוכרים', investor: 'משקיעים' }
  const statusLabels: Record<string, string> = { '': 'כל הסטטוסים', new: 'חדש', contacted: 'יצרנו קשר', qualified: 'מוסמך', negotiating: 'משא ומתן', won: 'נסגר', lost: 'אבד' }

  return (
    <CRMLayout>
      <Topbar title={`לידים (${filtered.length})`} action={canCreateLeads(role) ? { label: 'ליד חדש', onClick: () => setShowAdd(true) } : undefined} />
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} />}
      {confirmDeleteId && (
        <ConfirmDialog
          message="למחוק ליד זה? פעולה זו אינה ניתנת לביטול."
          confirmLabel="מחק"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {selectedLead && <LeadDetailPanel />}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4" dir="rtl">
          {/* Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <select value={intentFilter} onChange={e => setIntentFilter(e.target.value as IntentType | '')}
              className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 outline-none">
              {INTENT_OPTS.map(o => <option key={o} value={o}>{intentLabels[o]}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatus | '')}
              className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 outline-none">
              {STATUS_OPTS.map(o => <option key={o} value={o}>{statusLabels[o]}</option>)}
            </select>
            <input placeholder="סנן לפי עיר…" value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 outline-none w-36" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 outline-none mr-auto">
              <option value="ai_score">מיון: ציון AI</option>
              <option value="urgency_score">מיון: דחיפות</option>
              <option value="budget_max">מיון: תקציב</option>
              <option value="created_at">מיון: תאריך</option>
            </select>
          </div>

          {leadsLoading ? <Spinner /> : filtered.length === 0 ? (
            <EmptyState icon="📋" title="אין לידים" desc="הוסיפו ליד ראשון או שנו את הסינון" />
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden space-y-2">
                {filtered.map(l => (
                  <div key={l.id}
                    onClick={() => setSelectedLead(selectedLead?.id === l.id ? null : l)}
                    className={`glass rounded-xl p-3 cursor-pointer transition ${selectedLead?.id === l.id ? 'border-indigo-500/40' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar name={`${l.first_name} ${l.last_name}`} color={intentColor(l.intent_type)} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{l.first_name} {l.last_name}</div>
                        <div className="text-xs text-slate-500">{l.phone || l.email || l.source_platform}</div>
                      </div>
                      <IntentBadge intent={l.intent_type} />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-slate-400">📍 {l.city || '—'}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">{fmt(l.budget_min)}–{fmt(l.budget_max)}</span>
                      {l.rooms && <><span className="text-xs text-slate-500">•</span><span className="text-xs text-slate-400">{l.rooms}חד׳</span></>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1"><ScoreBar score={l.ai_score} /></div>
                      <StatusBadge status={l.status} />
                      {canDeleteLeads(role) && (
                        <button onClick={e => handleDelete(l.id, e)}
                          className="text-slate-600 hover:text-red-400 transition text-base px-1">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['ליד', 'מקור', 'כוונה', 'עיר', 'תקציב', 'נכס', 'דחיפות', 'ציון AI', 'סטטוס', ''].map(h => (
                        <th key={h} className="text-right px-3 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.id}
                        onClick={() => setSelectedLead(selectedLead?.id === l.id ? null : l)}
                        className={`border-b border-white/3 cursor-pointer transition ${selectedLead?.id === l.id ? 'bg-indigo-500/10' : 'hover:bg-white/3'}`}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={`${l.first_name} ${l.last_name}`} color={intentColor(l.intent_type)} size="sm" />
                            <div>
                              <div className="font-medium">{l.first_name} {l.last_name}</div>
                              <div className="text-xs text-slate-500">{l.phone || l.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400">{l.source_platform}</td>
                        <td className="px-3 py-3"><IntentBadge intent={l.intent_type} /></td>
                        <td className="px-3 py-3">
                          <div className="text-sm">{l.city || '—'}</div>
                          <div className="text-xs text-slate-500">{l.neighborhood}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-300">{fmt(l.budget_min)}–{fmt(l.budget_max)}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{l.rooms ? `${l.rooms}חד׳` : '—'} {l.property_type}</td>
                        <td className="px-3 py-3 w-24">
                          <ScoreBar score={l.urgency_score} showLabel={false} />
                          <div className="text-xs text-slate-600 mt-0.5">{l.urgency_score}/100</div>
                        </td>
                        <td className="px-3 py-3 w-24"><ScoreBar score={l.ai_score} /></td>
                        <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-3 py-3">
                          {canDeleteLeads(role) && (
                            <button onClick={e => handleDelete(l.id, e)}
                              className="text-slate-600 hover:text-red-400 transition text-base px-1">✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      </div>
    </CRMLayout>
  )
}
