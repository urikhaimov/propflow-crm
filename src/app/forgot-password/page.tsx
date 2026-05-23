'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError('שגיאה בשליחת האימייל. נסו שוב.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-sm glass rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-lg font-semibold mb-2">נשלח!</h2>
          <p className="text-sm text-slate-400 mb-6">
            אם {email} רשום במערכת, תקבלו לינק לאיפוס הסיסמה תוך דקה.
          </p>
          <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300 transition">
            חזרה לכניסה
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg">P</div>
          <div>
            <div className="font-bold text-lg">PropFlow CRM</div>
            <div className="text-xs text-slate-500">מנוע לידים AI</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h1 className="text-lg font-semibold mb-1">איפוס סיסמה</h1>
          <p className="text-sm text-slate-400 mb-6">נשלח לכם לינק לאיפוס לאימייל</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 rounded-xl text-sm font-medium transition"
            >
              {loading ? 'שולח...' : 'שלח לינק לאיפוס'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition">חזרה לכניסה</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
