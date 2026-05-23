'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    async function finish() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const user = session.user
      const meta = user.user_metadata || {}

      // Build display name from Google profile
      const name = meta.full_name || meta.name ||
        `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
        user.email?.split('@')[0] || 'משתמש'

      // Check if any admin already exists
      const { data: admins } = await supabase
        .from('agents')
        .select('id')
        .eq('role', 'admin')
        .limit(1)

      const isFirstAdmin = !admins || admins.length === 0

      // Check if this user already has a record
      const { data: existing } = await supabase
        .from('agents')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

      const role = isFirstAdmin ? 'admin' : (existing?.role || meta.role || 'agent')

      // Upsert into agents table
      await supabase.from('agents').upsert({
        id:        user.id,
        name,
        email:     user.email,
        role,
        is_active: true,
      }, { onConflict: 'id' })

      // Sync role back into auth metadata so the sidebar reads it immediately
      if (!existing || existing.role !== role || isFirstAdmin) {
        await supabase.auth.updateUser({ data: { ...meta, role } })
      }

      document.cookie = 'propflow_session=1; path=/; max-age=604800; SameSite=Lax'
      router.replace('/dashboard')
    }

    finish()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">מאמת חשבון...</p>
    </div>
  )
}
