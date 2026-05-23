'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('הסיסמאות אינן תואמות'); return }
    if (password.length < 6)  { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('שגיאה בעדכון הסיסמה. נסו שוב.')
      setLoading(false)
      return
    }

    document.cookie = 'propflow_session=1; path=/; max-age=604800; SameSite=Lax'
    router.replace('/dashboard')
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
          <h1 className="text-lg font-semibold mb-1">סיסמה חדשה</h1>
          <p className="text-sm text-slate-400 mb-6">הזינו סיסמה חדשה לחשבונכם</p>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">סיסמה חדשה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="מינימום 6 תווים"
                required
                className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">אישור סיסמה</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="הזינו שוב"
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
              {loading ? 'מעדכן...' : 'עדכן סיסמה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
