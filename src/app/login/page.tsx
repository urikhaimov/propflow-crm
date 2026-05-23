'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
      return
    }

    // Ensure the user has an agent record
    if (data.user) {
      const { data: admins } = await supabase.from('agents').select('id').eq('role', 'admin').limit(1)
      const { data: existing } = await supabase.from('agents').select('id, role').eq('id', data.user.id).maybeSingle()
      const isFirstAdmin = !admins || admins.length === 0
      const meta = data.user.user_metadata || {}
      const role = isFirstAdmin ? 'admin' : (existing?.role || meta.role || 'agent')
      const name = `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || data.user.email?.split('@')[0] || 'משתמש'
      if (!existing || (isFirstAdmin && existing.role !== 'admin')) {
        await supabase.from('agents').upsert({ id: data.user.id, name, email: data.user.email, role, is_active: true }, { onConflict: 'id' })
        if (isFirstAdmin) await supabase.auth.updateUser({ data: { ...meta, role } })
      }
    }

    document.cookie = 'propflow_session=1; path=/; max-age=604800; SameSite=Lax'
    router.replace('/dashboard')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setGoogleError(false)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setGoogleError(true)
      setGoogleLoading(false)
    }
    // on success the browser redirects — no need to setGoogleLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg">P</div>
          <div>
            <div className="font-bold text-lg">PropFlow CRM</div>
            <div className="text-xs text-slate-500">מנוע לידים AI</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h1 className="text-lg font-semibold mb-1">כניסה לחשבון</h1>
          <p className="text-sm text-slate-400 mb-6">ברוכים השבים לפרופלו</p>

          <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="••••••••"
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
              {loading ? 'נכנס...' : 'כניסה'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-slate-500">או</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-white/10 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? 'מחבר...' : 'כניסה עם Google'}
          </button>

          {googleError && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 space-y-2">
              <div className="font-semibold">⚙️ Google OAuth טעון הגדרה בסופאבייס</div>
              <ol className="list-decimal list-inside space-y-1 text-amber-300/80">
                <li>פתח <span className="font-mono">supabase.com</span> → הפרויקט שלך</li>
                <li>Authentication → Providers → Google → Enable</li>
                <li>הוסף Client ID ו-Client Secret מ-Google Cloud Console</li>
                <li>ב-Google Cloud: APIs &amp; Services → Credentials → OAuth 2.0</li>
                <li>Redirect URI: <span className="font-mono text-green-400 break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/auth/v1/callback</span></li>
              </ol>
            </div>
          )}

          <div className="flex items-center justify-between mt-5 text-xs text-slate-500">
            <Link href="/forgot-password" className="hover:text-white transition">שכחתי סיסמה</Link>
            <Link href="/register" className="hover:text-white transition">צור חשבון חדש</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
