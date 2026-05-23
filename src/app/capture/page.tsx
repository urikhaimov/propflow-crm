'use client'
// Public-facing lead capture form — embeddable on agency website
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IntentType } from '@/types'

const inputCls = 'w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition'
const labelCls = 'block text-xs text-slate-400 mb-1 font-medium'

export default function CapturePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    intent_type: 'buyer' as IntentType,
    city: '',
    budget_max: '',
    rooms: '',
    notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'אירעה שגיאה, נסו שוב')
        setLoading(false)
        return
      }
      router.push('/capture/success')
    } catch {
      setError('אירעה שגיאה, נסו שוב')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-white mb-2">מחפשים נכס?</h1>
          <p className="text-slate-400 text-sm">השאירו פרטים ונציג יחזור אליכם תוך שעה</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-white/8 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>שם פרטי *</label>
                <input
                  required
                  placeholder="ישראל"
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>שם משפחה *</label>
                <input
                  required
                  placeholder="ישראלי"
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>טלפון *</label>
              <input
                required
                type="tel"
                placeholder="050-000-0000"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>אימייל</label>
              <input
                type="email"
                placeholder="israel@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Intent */}
            <div>
              <label className={labelCls}>מה אתם מחפשים? *</label>
              <select
                value={form.intent_type}
                onChange={e => set('intent_type', e.target.value)}
                className={inputCls}
              >
                <option value="buyer">קנייה</option>
                <option value="renter">שכירות</option>
                <option value="seller">מכירה</option>
                <option value="investor">השקעה</option>
              </select>
            </div>

            {/* City + Rooms */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>עיר</label>
                <input
                  placeholder="תל אביב"
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>מספר חדרים</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  placeholder="3"
                  value={form.rooms}
                  onChange={e => set('rooms', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className={labelCls}>תקציב מקסימלי (₪)</label>
              <input
                type="number"
                placeholder="3,000,000"
                value={form.budget_max}
                onChange={e => set('budget_max', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>פרטים נוספים</label>
              <textarea
                rows={3}
                placeholder="קומה, חניה, גינה, קרבה לתחבורה…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  שולח…
                </span>
              ) : 'שלחו פרטים — נחזור תוך שעה'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-4">
            פרטיכם שמורים אצלנו בסודיות מלאה
          </p>
        </div>
      </div>
    </div>
  )
}
