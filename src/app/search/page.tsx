'use client'
// app/search/page.tsx
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { IntentBadge, StatusBadge, ScoreBar, Spinner, EmptyState } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { getLeads } from '@/lib/leads'
import { aiSearchLeads } from '@/lib/ai'
import { fmt, intentColor } from '@/lib/utils'

const SAVED_SEARCHES = [
  { name: 'קונים חמים ת"א 3M+', filters: 'קונים חמים תל אביב 3 מיליון', results: 12 },
  { name: 'מוכרים הרצליה יוקרה', filters: 'מוכרים הרצליה יוקרה', results: 4 },
  { name: 'שוכרים ירושלים סטודנטים', filters: 'שוכרים ירושלים סטודנטים', results: 8 },
  { name: 'משקיעים 5M+ פורטפוליו', filters: 'משקיעים תקציב 5 מיליון', results: 3 },
]

export default function SearchPage() {
  const { leads, setLeads } = useCRMStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(leads)
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    async function load() {
      const data = await getLeads()
      setLeads(data)
      setResults(data)
    }
    load()
  }, [])

  async function handleSearch(q = query) {
    if (!q.trim()) { setResults(leads); return }
    setSearching(true)
    setHasSearched(true)
    const found = await aiSearchLeads(q, leads)
    setResults(found)
    setSearching(false)
  }

  function loadSaved(filters: string) {
    setQuery(filters)
    handleSearch(filters)
  }

  return (
    <CRMLayout>
      <Topbar title="חיפוש חכם AI" />
      <div className="flex-1 overflow-y-auto p-5" dir="rtl">
        <div className="grid grid-cols-3 gap-5">
          {/* Left: search + saved */}
          <div className="space-y-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
              <div className="text-sm font-semibold text-indigo-300 mb-3">🧠 עוזר חיפוש AI</div>
              <div className="flex gap-2 mb-3">
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="לדוג׳: קונים דחופים תל אביב תקציב 4M"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 text-right" />
                <button onClick={() => handleSearch()} disabled={searching}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm font-medium transition disabled:opacity-50">
                  {searching ? '…' : '🔍'}
                </button>
              </div>
              <div className="text-xs text-slate-500">
                נסו: "שוכרים דחופים ירושלים" • "משקיעים תקציב 5M+" • "מוכרים חיפה יוקרה"
              </div>
            </div>

            {/* Saved searches */}
            <div className="glass rounded-2xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">חיפושים שמורים</div>
              {SAVED_SEARCHES.map(s => (
                <div key={s.name} onClick={() => loadSaved(s.filters)}
                  className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition mb-1 group">
                  <span className="text-lg">🔖</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.results} תוצאות • שידור חי</div>
                  </div>
                  <span className="text-slate-600 group-hover:text-white transition text-sm">›</span>
                </div>
              ))}
            </div>

            {/* Quick filters */}
            <div className="glass rounded-2xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">סינון מהיר</div>
              {[
                ['כוונה', 'קונה, מוכר, שוכר, משקיע'],
                ['עיר', 'ת"א, חיפה, ירושלים, הרצליה'],
                ['תקציב', '₪500K – ₪15M'],
                ['חדרים', '1–8+'],
                ['ציון AI', '0–100'],
                ['דחיפות', 'נמוך / בינוני / גבוה'],
                ['מקור', 'פייסבוק, יד2, טלגרם…'],
                ['סטטוס', 'חם, חמים, קר'],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-center justify-between py-1.5 text-sm border-b border-white/3 last:border-0">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-xs text-slate-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: results */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">
                {hasSearched ? `${results.length} תוצאות עבור "${query}"` : `כל הלידים (${leads.length})`}
              </div>
              {hasSearched && (
                <button onClick={() => { setQuery(''); setResults(leads); setHasSearched(false) }}
                  className="text-xs text-slate-500 hover:text-white transition">✕ נקה חיפוש</button>
              )}
            </div>

            {searching ? <Spinner /> : results.length === 0 ? (
              <EmptyState icon="🔍" title="לא נמצאו תוצאות" desc="נסו חיפוש שונה" />
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['ליד', 'כוונה', 'עיר', 'תקציב', 'נכס', 'ציון AI', 'סטטוס'].map(h => (
                        <th key={h} className="text-right px-3 py-2.5 text-xs text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(l => (
                      <tr key={l.id} className="border-b border-white/3 hover:bg-white/3 transition cursor-pointer">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: intentColor(l.intent_type), color: '#fff' }}>
                              {l.first_name[0]}{l.last_name?.[0] || ''}
                            </div>
                            <div>
                              <div className="font-medium">{l.first_name} {l.last_name}</div>
                              <div className="text-xs text-slate-500">{l.source_platform}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><IntentBadge intent={l.intent_type} /></td>
                        <td className="px-3 py-3 text-xs text-slate-400">{l.city || '—'}</td>
                        <td className="px-3 py-3 text-xs">{fmt(l.budget_min)}–{fmt(l.budget_max)}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{l.rooms ? `${l.rooms}חד׳` : '—'} {l.property_type}</td>
                        <td className="px-3 py-3 w-24"><ScoreBar score={l.ai_score} /></td>
                        <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </CRMLayout>
  )
}
