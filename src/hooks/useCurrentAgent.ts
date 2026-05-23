'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface CurrentAgent {
  id: string
  name: string
  email: string
  role: string
}

export function useCurrentAgent(): CurrentAgent | null {
  const [agent, setAgent] = useState<CurrentAgent | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata || {}
      const first = meta.first_name || ''
      const last  = meta.last_name  || ''
      setAgent({
        id:    user.id,
        name:  `${first} ${last}`.trim() || user.email?.split('@')[0] || 'משתמש',
        email: user.email || '',
        role:  meta.role || 'agent',
      })
    })
  }, [])

  return agent
}
