'use client'
// app/discovery/page.tsx — Real lead discovery from Reddit, Google, manual paste

import { useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { AIBox, SectionTitle } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { createLead } from '@/lib/leads'
import { fmt, scoreColor } from '@/lib/utils'

type DiscoveredLead = {
  first_name: string
  last_name: string
  intent_type: string
  city: string
  neighborhood: string
  budget_min: number
  budget_max: number
  rooms: number
  property_type: string
  ai_score: number
  urgency_score: number
  ai_summary: string
  tags: string[]
  source_platform: string
  original_post: string
  source_url?: string
  saved?: boolean
  saving?: boolean
}

const SOURCE_CONFIG = [
  { key: 'reddit',  label: 'Reddit',           emoji: '🌐', desc: 'r/Israel, r/israelrealestate', free: true },
  { key: 'google',  label: 'Google Search',     emoji: '🔍', desc: '100 חיפושים חינם ביום',       free: true },
  { key: 'manual',  label: 'הדבקה ידנית',       emoji: '📋', desc: 'פייסבוק, טלגרם, וואטסאפ',     free: true },
]

const KEYWORD_PRESETS = [
  'apartment israel buy', 'דירה לקנייה תל אביב', 'דירה להשכרה ירושלים',
  'מוכר דירה חיפה', 'investment property israel', 'looking for apartment tel aviv',
  'need 4 room apartment', 'דירה 4 חדרים', 'villa for sale israel',
]

export default function DiscoveryPage() {
  const { addLead } = useCRMStore()

  const [keyword, setKeyword]           = useState('apartment israel real estate')
  const [selectedSources, setSelected] = useState<string[]>(['reddit', 'manual'])
  const [manualText, setManualText]     = useState('')
  const [manualSource, setManualSource] = useState('facebook')
  const [running, setRunning]           = useState(false)
  const [leads, setLeads]               = useState<DiscoveredLead[]>([])
  const [stats, setStats]               = useState({ scanned: 0, extracted: 0 })
  const [log, setLog]                   = useState<string[]>([])
  const [googleNote, setGoogleNote]     = useState('')

  function toggleSource(key: string) {
    setSelected(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])
  }

  function addLog(msg: string) {
    setLog(prev => [`${new Date().toLocaleTimeString('he-IL')} — ${msg}`, ...prev.slice(0, 19)])
  }

  async function runDiscovery() {
    if (selectedSources.length === 0) return
    setRunning(true)
    setLeads([])
    setLog([])
    setStats({ scanned: 0, extracted: 0 })
    setGoogleNote('')

    addLog('מתחיל סריקה...')

    const manualPosts = manualText.trim()
      ? [{ text: manualText.trim(), source: manualSource }]
      : []

    if (manualPosts.length) addLog(`נוספו ${manualPosts.length} פוסטים ידניים`)
    if (selectedSources.includes('reddit')) addLog('סורק Reddit...')
    if (selectedSources.includes('google')) addLog('סורק Google Search...')

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: selectedSources,
          keyword,
          manualPosts,
        }),
      })

      const data = await res.json()

      if (data.googleNote) setGoogleNote(data.googleNote)
      addLog(`נסרקו ${data.scanned} פוסטים`)
      addLog(`Claude חילץ ${data.extracted} לידים`)

      setStats({ scanned: data.scanned, extracted: data.extracted })
      setLeads(data.leads || [])

      if (data.extracted === 0) addLog('לא נמצאו לידים. נסו מילות חיפוש אחרות.')
      else addLog(`✅ סיום — ${data.extracted} לידים מוכנים לשמירה`)

    } catch (err) {
      addLog(`❌ שגיאה: ${String(err)}`)
    }

    setRunning(false)
  }

  async function saveLead(idx: number) {
    const lead = leads[idx]
    setLeads(prev => prev.map((l, i) => i === idx ? { ...l, saving: true } : l))
    try {
      const saved = await createLead({
        first_name:      lead.first_name || 'לא',
        last_name:       lead.last_name  || 'ידוע',
        intent_type:     lead.intent_type as any || 'buyer',
        city:            lead.city,
        neighborhood:    lead.neighborhood,
        budget_min:      lead.budget_min,
        budget_max:      lead.budget_max,
        rooms:           lead.rooms,
        property_type:   lead.property_type as any || 'apartment',
        source_platform: lead.source_platform || 'crawler',
        original_post:   lead.original_post,
        ai_score:        lead.ai_score    || 60,
        urgency_score:   lead.urgency_score || 50,
        ai_summary:      lead.ai_summary,
        tags:            lead.tags || [],
        status:          'new',
      })
      addLead(saved)
      setLeads(prev => prev.map((l, i) => i === idx ? { ...l, saved: true, saving: false } : l))
      addLog(`✅ ליד נשמר: ${lead.first_name} ${lead.last_name}`)
    } catch (err) {
      setLeads(prev => prev.map((l, i) => i === idx ? { ...l, saving: false } : l))
      addLog(`❌ שגיאה בשמירה: ${String(err)}`)
    }
  }

  async function saveAll() {
    for (let i = 0; i < leads.length; i++) {
      if (!leads[i].saved) await saveLead(i)
    }
  }

  const intentColors: Record<string, string> = {
    buyer: 'bg-indigo-500/15 text-indigo-300',
    seller: 'bg-green-500/15 text-green-300',
    renter: 'bg-amber-500/15 text-amber-300',
    investor: 'bg-purple-500/15 text-purple-300',
  }

  return (
    <CRMLayout>
      <Topbar
        title="AI גילוי לידים — אמיתי"
        action={{ label: running ? 'סורק…' : '🔍 הפעל סריקה', onClick: runDiscovery }}
      />

      <div className="flex-1 overflow-y-auto p-5" dir="rtl">
        <div className="grid grid-cols-2 gap-5">

          {/* ── LEFT: Config ───────────────────────────────── */}
          <div className="space-y-4">

            {/* Source selector */}
            <div className="glass rounded-2xl p-4">
              <SectionTitle>מקורות נתונים</SectionTitle>
              <div className="space-y-2">
                {SOURCE_CONFIG.map(src => (
                  <div key={src.key}
                    onClick={() => toggleSource(src.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition ${
                      selectedSources.includes(src.key)
                        ? 'border-indigo-500/40 bg-indigo-500/10'
                        : 'border-white/5 hover:border-white/10'
                    }`}>
                    <span className="text-xl">{src.emoji}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{src.label}</div>
                      <div className="text-xs text-slate-500">{src.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400">חינם ✓</span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                        selectedSources.includes(src.key)
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-slate-600'
                      }`}>
                        {selectedSources.includes(src.key) && <span className="text-white text-xs">✓</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keyword */}
            <div className="glass rounded-2xl p-4">
              <SectionTitle>מילות חיפוש</SectionTitle>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="לדוג׳: apartment tel aviv buy"
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 mb-3"
              />
              <div className="flex flex-wrap gap-1.5">
                {KEYWORD_PRESETS.map(kw => (
                  <button key={kw} onClick={() => setKeyword(kw)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 rounded-full text-xs text-slate-400 hover:text-indigo-300 transition">
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual paste */}
            {selectedSources.includes('manual') && (
              <div className="glass rounded-2xl p-4">
                <SectionTitle>📋 הדבקה ידנית</SectionTitle>
                <p className="text-xs text-slate-500 mb-3">
                  העתיקו פוסט מפייסבוק, טלגרם, וואטסאפ או כל מקום אחר — Claude יחלץ את הליד
                </p>
                <select
                  value={manualSource}
                  onChange={e => setManualSource(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none mb-2">
                  <option value="facebook">פייסבוק</option>
                  <option value="telegram">טלגרם</option>
                  <option value="whatsapp">וואטסאפ</option>
                  <option value="yad2">יד2</option>
                  <option value="madlan">מדלן</option>
                  <option value="other">אחר</option>
                </select>
                <textarea
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  placeholder="הדבק כאן את הפוסט... לדוג׳: &#39;מחפש דירת 4 חדרים בתל אביב, תקציב עד 3 מיליון, צריך לעבור תוך חודש&#39;"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 resize-none"
                  rows={4}
                />
              </div>
            )}

            {/* Google note */}
            {googleNote && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                <div className="font-semibold mb-1">⚙️ Google Search — הגדרה נדרשת</div>
                <div className="text-amber-400/80 mb-2">
                  הוסיפו ל-.env.local:
                </div>
                <code className="block bg-slate-900 p-2 rounded text-xs text-green-400 leading-relaxed">
                  GOOGLE_SEARCH_API_KEY=your-key<br/>
                  GOOGLE_SEARCH_ENGINE_ID=your-cx-id
                </code>
                <a href="https://developers.google.com/custom-search/v1/overview"
                  target="_blank" rel="noreferrer"
                  className="text-indigo-400 hover:underline mt-1 block">
                  הוראות הגדרה ←
                </a>
              </div>
            )}

            {/* Stats */}
            {(stats.scanned > 0 || running) && (
              <div className="glass rounded-2xl p-4">
                <SectionTitle>סטטיסטיקת סריקה</SectionTitle>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'פוסטים נסרקו', val: stats.scanned, color: 'text-slate-300' },
                    { label: 'לידים חולצו', val: stats.extracted, color: 'text-indigo-400' },
                    { label: 'נשמרו', val: leads.filter(l => l.saved).length, color: 'text-green-400' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-slate-800 rounded-xl p-2.5">
                      <div className={`text-xl font-bold ${color}`}>{val}</div>
                      <div className="text-xs text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity log */}
            {log.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <SectionTitle>לוג פעילות</SectionTitle>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {log.map((entry, i) => (
                    <div key={i} className="text-xs text-slate-400 font-mono">{entry}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Results ─────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>לידים שהתגלו ({leads.length})</SectionTitle>
              {leads.filter(l => !l.saved).length > 0 && (
                <button onClick={saveAll}
                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-xs font-medium transition">
                  💾 שמור הכל ({leads.filter(l => !l.saved).length})
                </button>
              )}
            </div>

            {running && leads.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
                <div className="text-sm text-slate-400">סורק מקורות וניתוח עם Claude AI...</div>
                <div className="text-xs text-slate-600 mt-1">זה יכול לקחת 20-30 שניות</div>
              </div>
            )}

            {!running && leads.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-slate-500">
                <div className="text-4xl mb-3">🤖</div>
                <div className="text-sm">בחרו מקורות ולחצו "הפעל סריקה"</div>
                <div className="text-xs mt-2 text-slate-600">
                  Claude יסרוק פוסטים אמיתיים ויחלץ לידים אוטומטית
                </div>
              </div>
            )}

            <div className="space-y-3">
              {leads.map((lead, idx) => (
                <div key={idx} className={`glass rounded-2xl p-4 border transition ${
                  lead.saved ? 'border-green-500/30' : 'border-white/5'
                }`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${intentColors[lead.intent_type] || 'bg-slate-700 text-slate-300'}`}>
                        {lead.intent_type}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-800 rounded-full text-slate-400">
                        {lead.source_platform}
                      </span>
                      {lead.city && (
                        <span className="text-xs text-slate-500">📍 {lead.city}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: scoreColor(lead.ai_score || 0) }}>
                        {lead.ai_score || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Post snippet */}
                  {lead.original_post && (
                    <p className="text-xs text-slate-400 italic mb-2 line-clamp-2">
                      "{lead.original_post.substring(0, 120)}…"
                    </p>
                  )}

                  {/* AI Summary */}
                  {lead.ai_summary && (
                    <div className="bg-indigo-500/10 border border-indigo-500/15 rounded-lg px-3 py-2 mb-3">
                      <div className="text-xs text-indigo-400 font-medium mb-0.5">🤖 Claude</div>
                      <div className="text-xs text-slate-300">{lead.ai_summary}</div>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
                    {lead.rooms && <span>🚪 {lead.rooms} חדרים</span>}
                    {lead.budget_max && <span>💰 {fmt(lead.budget_max)}</span>}
                    {lead.property_type && <span>🏠 {lead.property_type}</span>}
                    {lead.urgency_score && <span>⚡ דחיפות {lead.urgency_score}</span>}
                  </div>

                  {/* Tags */}
                  {lead.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {lead.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-800 rounded-full text-xs text-slate-400">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    {lead.source_url && (
                      <a href={lead.source_url} target="_blank" rel="noreferrer"
                        className="text-xs text-indigo-400 hover:underline">
                        צפה במקור ←
                      </a>
                    )}
                    {lead.saved ? (
                      <span className="text-xs text-green-400 font-medium mr-auto">✓ נשמר ב-CRM</span>
                    ) : (
                      <button onClick={() => saveLead(idx)} disabled={lead.saving}
                        className="mr-auto px-4 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium transition disabled:opacity-50">
                        {lead.saving ? 'שומר…' : '+ הוסף ל-CRM'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CRMLayout>
  )
}
