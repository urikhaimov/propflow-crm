'use client'
// components/leads/LeadDetailPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import { useCRMStore } from '@/store/crm'
import { updateLead } from '@/lib/leads'
import { generateEmail } from '@/lib/ai'
import { IntentBadge, StatusBadge, ScoreBar, Avatar, AIBox, SectionTitle, AreaScoreBadge } from '@/components/ui'
import { fmt, intentColor, statusLabel, timeAgo } from '@/lib/utils'
import type { LeadStatus, Activity } from '@/types'

const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'negotiating', 'won', 'lost']

const activityIcon: Record<string, string> = {
  email: '📧', call: '📞', note: '📝', status_change: '🔄', match: '🎯', discovery: '🔍',
}

export default function LeadDetailPanel() {
  const { selectedLead, setSelectedLead, updateLead: storeUpdate } = useCRMStore()
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [copied, setCopied] = useState(false)

  const l = selectedLead

  const fetchActivities = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(`/api/activities?lead_id=${leadId}`)
      const data = await res.json()
      setActivities(data.activities || [])
    } catch {
      setActivities([])
    }
  }, [])

  useEffect(() => {
    if (l?.id) {
      setActivities([])
      setEmailDraft('')
      fetchActivities(l.id)
    }
  }, [l?.id, fetchActivities])

  if (!l) return null

  async function handleStatusChange(status: LeadStatus) {
    await updateLead(l!.id, { status })
    storeUpdate(l!.id, { status })
  }

  async function handleGenerateEmail() {
    setGeneratingEmail(true)
    const email = await generateEmail(l!, `הם ${l!.intent_type === 'buyer' ? 'מחפשים לקנות' : l!.intent_type === 'renter' ? 'מחפשים לשכור' : 'מעוניינים'} נכס ב${l!.city}`)
    setEmailDraft(email)
    setGeneratingEmail(false)
  }

  async function handleMarkSent() {
    const message = emailDraft || l!.ai_follow_up || ''
    if (!message) return

    try {
      await navigator.clipboard.writeText(message)
    } catch { /* clipboard not available */ }

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: l!.id, type: 'email', content: message }),
    })
    const data = await res.json()
    if (data.activity) {
      setActivities(prev => [data.activity, ...prev])
    }

    if (l!.status === 'new') {
      await updateLead(l!.id, { status: 'contacted' })
      storeUpdate(l!.id, { status: 'contacted' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />

      {/* Panel */}
      <div className="relative w-full sm:w-[480px] sm:max-w-[95vw] max-h-[92dvh] sm:max-h-[90vh] bg-slate-900 border border-white/8 sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden shadow-2xl">
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
            {l.city && (
              <div className="flex items-center gap-2 text-slate-300 flex-wrap">
                📍 <span>{l.city}{l.neighborhood ? ` / ${l.neighborhood}` : ''}</span>
                <AreaScoreBadge city={l.city} />
              </div>
            )}
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
          <div className="flex gap-2 mt-2">
            <button onClick={handleGenerateEmail} disabled={generatingEmail}
              className="flex-1 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium transition disabled:opacity-50">
              {generatingEmail ? 'יוצר…' : '🤖 צור הודעה חדשה'}
            </button>
            {(emailDraft || l.ai_follow_up) && (
              <button onClick={handleMarkSent}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${copied ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                {copied ? '✅ הועתק!' : '📋 העתק + סמן כנשלח'}
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button className="py-2 glass hover:bg-white/5 rounded-xl text-xs font-medium transition">
            🎯 מצא התאמות
          </button>
          <button className="py-2 glass hover:bg-white/5 rounded-xl text-xs font-medium transition">
            📅 קבע פגישה
          </button>
        </div>

        {/* Activity timeline */}
        {activities.length > 0 && (
          <div>
            <SectionTitle>היסטוריית פעילות</SectionTitle>
            <div className="space-y-2">
              {activities.map(a => (
                <div key={a.id} className="flex gap-2.5 text-xs">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-sm">
                    {activityIcon[a.type] || '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-300 truncate">{a.content || a.type}</div>
                    <div className="text-slate-600">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
