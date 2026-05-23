// app/api/setup/route.ts
// One-time bootstrap: if no agents exist yet, make the current user admin.
// Safe to call multiple times — does nothing if an admin already exists.
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  // 1. Check auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 2. Block if any admin already exists
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Admin already exists — ask your admin to upgrade your role.' }, { status: 403 })
  }

  // 3. Build name from metadata
  const meta = user.user_metadata || {}
  const first = meta.first_name || meta.name?.split(' ')[0] || ''
  const last  = meta.last_name  || meta.name?.split(' ')[1] || ''
  const name  = `${first} ${last}`.trim() || user.email?.split('@')[0] || 'Admin'

  // 4. Upsert the agent record as admin
  const { error: agentErr } = await supabase.from('agents').upsert({
    id: user.id,
    name,
    email: user.email,
    role: 'admin',
    is_active: true,
  }, { onConflict: 'id' })

  if (agentErr) {
    return NextResponse.json({ error: agentErr.message }, { status: 500 })
  }

  // 5. Update auth metadata so the sidebar sees the new role immediately
  const { error: metaErr } = await supabase.auth.updateUser({
    data: { ...meta, role: 'admin' },
  })

  if (metaErr) {
    return NextResponse.json({ error: metaErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, name, email: user.email })
}
