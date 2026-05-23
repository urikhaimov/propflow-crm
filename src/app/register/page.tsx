'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROLE_OPTIONS = [
  { value: 'agent',        label: 'סוכן' },
  { value: 'junior_agent', label: 'סוכן זוטר' },
  { value: 'senior_agent', label: 'סוכן בכיר' },
  { value: 'admin',        label: 'מנהל' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [role, setRole]           = useState('agent')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, role },
      },
    })

    if (signUpError) {
      setError(signUpError.message === 'User already registered' ? 'אימייל זה כבר רשום במערכת' : signUpError.message)
      setLoading(false)
      return
    }

    // Insert into agents table if session is available immediately
    if (data.session) {
      await supabase.from('agents').upsert([{
        id: data.user!.id,
        name: `${firstName} ${lastName}`.trim(),
        email,
        role,
        is_active: true,
      }], { onConflict: 'id' })

      document.cookie = 'propflow_session=1; path=/; max-age=604800; SameSite=Lax'
      router.replace('/dashboard')
      return
    }

    // Email confirmation required
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-sm glass rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-lg font-semibold mb-2">בדקו את האימייל שלכם</h2>
          <p className="text-sm text-slate-400 mb-6">
            שלחנו לינק אישור ל-<strong className="text-white">{email}</strong>.<br />
            לחצו על הלינק כדי לאמת את החשבון ולהתחיל.
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
          <h1 className="text-lg font-semibold mb-1">יצירת חשבון</h1>
          <p className="text-sm text-slate-400 mb-6">הצטרפו לצוות PropFlow</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">שם פרטי</label>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="ישראל"
                  required
                  className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">שם משפחה</label>
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="ישראלי"
                  required
                  className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">תפקיד</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

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

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="מינימום 6 תווים"
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
              {loading ? 'יוצר חשבון...' : 'צור חשבון'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            יש לך כבר חשבון?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition">כניסה</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
