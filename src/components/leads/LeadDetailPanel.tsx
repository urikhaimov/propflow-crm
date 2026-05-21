'use client'
// components/leads/LeadDetailPanel.tsx
import { useState } from 'react'
import { useCRMStore } from '@/store/crm'
import { updateLead } from '@/lib/leads'
import { generateEmail } from '@/lib/ai'
import { IntentBadge, StatusBadge, ScoreBar, Avatar, AIBox, SectionTitle } from '@/components/ui'
import { fmt, intentColor, statusLabel } from '@/lib/utils'
import type { LeadStatus } from '@/types'

const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'negotiating', 'won', 'lost']

export default function LeadDetailPanel() {
  const { selectedLead, setSelectedLead, updateLead: storeUpdate } = useCRMStore()
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')

  if (!selectedLead) return null

  const l = selectedLead

  async function handleStatusChange(status: LeadStatus) {
    await updateLead(l.id, { status })
    storeUpdate(l.id, { status })
  }

  async function handleGenerateEmail() {
    setGeneratingEmail(true)
    const email = await generateEmail(l, `הם ${l.intent_type === 'buyer' ? 'מחפשים לקנות' : l.intent_type === 'renter' ? 'מחפשים לשכור' : 'מעוניינים'} נכס ב${l.city}`)
    setEmailDraft(email)
    setGeneratingEmail(false)
  }

  return (
    <div className="w-80 bg-slate-900 border-r border-white/5 flex flex-col h-full overflow-y-auto flex-shrink-0" dir="rtl">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-start gap-3">
        <Avatar name={`${l.first_name} ${l.last_name}`} color={intentColor(l.intent_type)} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{l.first_name} {l.last_name}</div>
          <div className="text-xs text-slate-500 mt-0.5">{l.source_platform} • {new Date(l.created_at).toLocaleDateString('he-IL')}</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            <IntentBadge intent={l.intent_type} />
            <StatusBadge status={l.status} />
          </div>
        </div>
        <button onClick={() => setSelectedLead(null)} className="text-slate-600 hover:text-white transition p-1">✕</button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col gap-4">

        {/* AI Score */}
        <div>
          <SectionTitle>ציון AI</SectionTitle>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl font-bold text-indigo-400">{l.ai_score}</div>
            <ScoreBar score={l.ai_score} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 text-center bg-slate-800 rounded-lg p-2">
              <div className="text-sm font-semibold text-amber-400">{l.urgency_score}</div>
              <div className="text-xs text-slate-500">דחיפות</div>
            </div>
            <div className="flex-1 text-center bg-slate-800 rounded-lg p-2">
              <div className="text-sm font-semibold">{l.rooms || '—'}</div>
              <div className="text-xs text-slate-500">חדרים</div>
            </div>
            <div className="flex-1 text-center bg-slate-800 rounded-lg p-2">
              <div className="text-sm font-semibold text-green-400">{fmt(l.budget_max)}</div>
              <div className="text-xs text-slate-500">תקציב</div>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {l.ai_summary && (
          <AIBox title="סיכום AI">
            {l.ai_summary}
          </AIBox>
        )}

        {/* Contact */}
        <div>
          <SectionTitle>פרטי קשר</SectionTitle>
          <div className="space-y-2 text-sm">
            {l.phone && <div className="flex items-center gap-2 text-indigo-400">📱 <span>{l.phone}</span></div>}
            {l.email && <div className="flex items-center gap-2 text-slate-300">📧 <span className="truncate">{l.email}</span></div>}
            {l.city && <div className="flex items-center gap-2 text-slate-300">📍 <span>{l.city}{l.neighborhood ? ` / ${l.neighborhood}` : ''}</span></div>}
          </div>
        </div>

        {/* Budget & Property */}
        <div>
          <SectionTitle>דרישות נכס</SectionTitle>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-slate-800 p-2 rounded-lg"><div className="text-xs text-slate-500">תקציב מינ׳</div><div className="font-medium">{fmt(l.budget_min)}</div></div>
            <div className="bg-slate-800 p-2 rounded-lg"><div className="text-xs text-slate-500">תקציב מקס׳</div><div className="font-medium">{fmt(l.budget_max)}</div></div>
            <div className="bg-slate-800 p-2 rounded-lg"><div className="text-xs text-slate-500">חדרים</div><div className="font-medium">{l.rooms || '—'}</div></div>
            <div className="bg-slate-800 p-2 rounded-lg"><div className="text-xs text-slate-500">סוג נכס</div><div className="font-medium">{l.property_type}</div></div>
          </div>
        </div>

        {/* Original Post */}
        {l.original_post && (
          <div>
            <SectionTitle>פוסט מקורי</SectionTitle>
            <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 italic leading-relaxed">
              "{l.original_post}"
            </div>
          </div>
        )}

        {/* Tags */}
        {l.tags?.length > 0 && (
          <div>
            <SectionTitle>תגיות</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {l.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 rounded-full text-xs">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Status change */}
        <div>
          <SectionTitle>עדכון סטטוס</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {statuses.map(s => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={`py-1.5 rounded-lg text-xs font-medium transition ${l.status === s ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Follow-up */}
        <div>
          <SectionTitle>AI פולו-אפ</SectionTitle>
          {l.ai_follow_up && !emailDraft && (
            <AIBox title="הודעת המשך מוצעת">
              {l.ai_follow_up}
            </AIBox>
          )}
          {emailDraft && (
            <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-200 leading-relaxed mb-2 whitespace-pre-wrap">
              {emailDraft}
            </div>
          )}
          <button onClick={handleGenerateEmail} disabled={generatingEmail}
            className="w-full mt-2 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium transition disabled:opacity-50">
            {generatingEmail ? 'יוצר הודעה…' : '🤖 צור הודעה AI חדשה'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-sm font-medium transition">
            📤 שלח הודעה
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-2 glass hover:bg-white/5 rounded-xl text-xs font-medium transition">
              🎯 מצא התאמות
            </button>
            <button className="py-2 glass hover:bg-white/5 rounded-xl text-xs font-medium transition">
              📅 קבע פגישה
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
