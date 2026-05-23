'use client'
// app/matching/page.tsx
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { AIBox, IntentBadge, ScoreBar, Spinner } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { getLeads } from '@/lib/leads'
import { getProperties } from '@/lib/properties'
import { matchLeadsToProperty } from '@/lib/ai'
import { fmt, scoreColor } from '@/lib/utils'
import type { AIMatchResult } from '@/types'

export default function MatchingPage() {
  const { leads, setLeads, properties, setProperties } = useCRMStore()
  const [matches, setMatches] = useState<AIMatchResult[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function load() {
      const [l, p] = await Promise.all([getLeads(), getProperties()])
      setLeads(l)
      setProperties(p)
    }
    load()
  }, [])

  async function runMatching() {
    setRunning(true)
    setMatches([])
    setDone(false)
    const results: AIMatchResult[] = []
    for (const property of properties.slice(0, 4)) {
      const buyers = leads.filter(l => l.intent_type === 'buyer' || l.intent_type === 'investor')
      const scored = await matchLeadsToProperty(property, buyers)
      for (const { lead_id, score, reason } of scored) {
        const lead = leads.find(l => l.id === lead_id)
        if (lead) results.push({ lead, property, score, reason })
      }
      setMatches([...results])
    }
    results.sort((a, b) => b.score - a.score)
    setMatches(results)
    setRunning(false)
    setDone(true)
  }

  return (
    <CRMLayout>
      <Topbar title="מנוע התאמה AI" action={{ label: running ? 'מתאים…' : 'הפעל התאמה', onClick: runMatching }} />
      <div className="flex-1 overflow-y-auto p-3 md:p-5" dir="rtl">

        {/* Explanation */}
        <AIBox title="כיצד פועל מנוע ההתאמה">
          הציון מחושב על בסיס: embedding סמנטי (תיאור נכס מול כוונת ליד), חפיפת תקציב, מרחק עיר,
          הפרש חדרים, משקל דחיפות, ותאימות סוג נכס. המשקלות מכוילים לפי נתוני המרה היסטוריים.
        </AIBox>

        <div className="mt-4 grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'לידים זמינים', val: leads.length, icon: '👥' },
            { label: 'נכסים לבדיקה', val: properties.length, icon: '🏢' },
            { label: 'התאמות שנמצאו', val: matches.length, icon: '⚡' },
          ].map(({ label, val, icon }) => (
            <div key={label} className="glass rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-2xl font-bold">{val}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {running && (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <span className="text-sm">מנתח התאמות עם Claude AI…</span>
          </div>
        )}

        {matches.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">תוצאות התאמה</div>
            {matches.map((m, i) => (
              <div key={i} className="glass rounded-2xl p-4">
                <div className="flex gap-4">
                  {/* Lead */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-1">ליד</div>
                    <div className="font-semibold text-sm">{m.lead.first_name} {m.lead.last_name}</div>
                    <div className="text-xs text-slate-400">{m.lead.city} • {m.lead.rooms}חד׳</div>
                    <div className="text-xs text-slate-400">{fmt(m.lead.budget_min)}–{fmt(m.lead.budget_max)}</div>
                    <div className="mt-1"><IntentBadge intent={m.lead.intent_type} /></div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center justify-center gap-1 px-3">
                    <div className="text-2xl font-bold" style={{ color: scoreColor(m.score) }}>{m.score}%</div>
                    <ScoreBar score={m.score} showLabel={false} />
                    <div className="text-xs text-slate-600">התאמה</div>
                    <div className="text-xl">⚡</div>
                  </div>

                  {/* Property */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-1">נכס</div>
                    <div className="font-semibold text-sm">{m.property.title}</div>
                    <div className="text-xs text-slate-400">{m.property.rooms}חד׳ • {m.property.area}מ״ר</div>
                    <div className="text-xs text-indigo-400 font-medium">{fmt(m.property.price || 0, m.property.is_rental)}</div>
                    <div className="mt-1">
                      <span className="px-2 py-0.5 bg-green-500/15 text-green-300 rounded-full text-xs">{m.property.status}</span>
                    </div>
                  </div>
                </div>

                {/* AI reason */}
                <div className="mt-3">
                  <AIBox title="הסבר AI">
                    {m.reason}
                  </AIBox>
                </div>

                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-xs font-semibold transition">
                    🔗 חבר ביניהם
                  </button>
                  <button className="flex-1 py-2 glass hover:bg-white/5 rounded-xl text-xs font-medium transition">
                    📧 שלח מייל היכרות
                  </button>
                  <button className="flex-1 py-2 glass hover:bg-white/5 rounded-xl text-xs font-medium transition">
                    📅 קבע ביקור
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {done && matches.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <div>לא נמצאו התאמות מספקות. נסו להוסיף עוד לידים ונכסים.</div>
          </div>
        )}

        {!running && !done && matches.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎯</div>
            <div className="text-lg font-semibold mb-2">מנוע ההתאמה מוכן</div>
            <div className="text-sm text-slate-500 mb-4">הפעילו את ה-AI לחיבור אוטומטי בין לידים לנכסים</div>
            <button onClick={runMatching} className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl font-semibold transition">
              🤖 הפעל התאמה AI
            </button>
          </div>
        )}
      </div>
    </CRMLayout>
  )
}
