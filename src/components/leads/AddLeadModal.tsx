'use client'
// components/leads/AddLeadModal.tsx
import { useState } from 'react'
import { createLead } from '@/lib/leads'
import { scoreLeadWithAI } from '@/lib/ai'
import { useCRMStore } from '@/store/crm'
import type { IntentType, PropertyType } from '@/types'

interface Props { onClose: () => void }

export default function AddLeadModal({ onClose }: Props) {
  const { addLead } = useCRMStore()
  const [loading, setLoading] = useState(false)
  const [aiScoring, setAiScoring] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    intent_type: 'buyer' as IntentType,
    city: '', neighborhood: '',
    budget_min: '', budget_max: '',
    rooms: '', property_type: 'apartment' as PropertyType,
    source_platform: 'manual',
    original_post: '', notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAiScoring(true)

    const payload = {
      ...form,
      budget_min: form.budget_min ? Number(form.budget_min) : undefined,
      budget_max: form.budget_max ? Number(form.budget_max) : undefined,
      rooms: form.rooms ? Number(form.rooms) : undefined,
    }

    // Score with AI
    let aiFields = {}
    try {
      const scored = await scoreLeadWithAI(payload)
      aiFields = {
        ai_score: scored.ai_score,
        urgency_score: scored.urgency_score,
        ai_summary: scored.ai_summary,
        ai_follow_up: scored.ai_follow_up,
        tags: scored.tags,
      }
    } catch {
      aiFields = { ai_score: 60, urgency_score: 50 }
    }
    setAiScoring(false)

    const lead = await createLead({ ...payload, ...aiFields })
    addLead(lead)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-bold">➕ ליד חדש</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-2 gap-3">
          <input required placeholder="שם פרטי *" value={form.first_name} onChange={e => set('first_name', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />
          <input required placeholder="שם משפחה *" value={form.last_name} onChange={e => set('last_name', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />
          <input type="email" placeholder="אימייל" value={form.email} onChange={e => set('email', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />
          <input placeholder="טלפון" value={form.phone} onChange={e => set('phone', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />

          <select value={form.intent_type} onChange={e => set('intent_type', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none">
            <option value="buyer">קונה</option>
            <option value="seller">מוכר</option>
            <option value="renter">שוכר</option>
            <option value="investor">משקיע</option>
          </select>
          <select value={form.source_platform} onChange={e => set('source_platform', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none">
            <option value="manual">ידני</option>
            <option value="facebook">פייסבוק</option>
            <option value="telegram">טלגרם</option>
            <option value="yad2">יד2</option>
            <option value="reddit">Reddit</option>
            <option value="twitter">Twitter/X</option>
            <option value="website">אתר</option>
            <option value="referral">הפניה</option>
          </select>

          <input placeholder="עיר" value={form.city} onChange={e => set('city', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />
          <input placeholder="שכונה" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />

          <input type="number" placeholder="תקציב מינ׳ (₪)" value={form.budget_min} onChange={e => set('budget_min', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />
          <input type="number" placeholder="תקציב מקס׳ (₪)" value={form.budget_max} onChange={e => set('budget_max', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />

          <input type="number" placeholder="מספר חדרים" value={form.rooms} onChange={e => set('rooms', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition" />
          <select value={form.property_type} onChange={e => set('property_type', e.target.value)}
            className="col-span-1 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none">
            <option value="apartment">דירה</option>
            <option value="villa">וילה</option>
            <option value="penthouse">פנטהאוז</option>
            <option value="studio">סטודיו</option>
            <option value="commercial">מסחרי</option>
          </select>

          <textarea placeholder="פוסט / הודעה מקורית (לניתוח AI)" value={form.original_post} onChange={e => set('original_post', e.target.value)}
            className="col-span-2 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition resize-none" rows={3} />
          <textarea placeholder="הערות" value={form.notes} onChange={e => set('notes', e.target.value)}
            className="col-span-2 px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm outline-none focus:border-indigo-500 transition resize-none" rows={2} />

          {aiScoring && (
            <div className="col-span-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-xs text-indigo-300 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
              מנתח ליד עם AI — מחשב ציון, דחיפות, תגיות…
            </div>
          )}

          <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
            <button type="button" onClick={onClose}
              className="py-2.5 glass hover:bg-white/5 rounded-xl text-sm font-medium transition">ביטול</button>
            <button type="submit" disabled={loading}
              className="py-2.5 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? 'שומר…' : '✨ שמור + ניתוח AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
