'use client'
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCRMStore } from '@/store/crm'
import { supabase } from '@/lib/supabase'
import { canAccessSettings, canRunDiscovery, canManageAgents } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'לוח בקרה', icon: '📊', section: 'main' },
  { href: '/leads', label: 'לידים', icon: '👥', section: 'main', badge: 'leads' },
  { href: '/pipeline', label: 'פייפליין', icon: '⚡', section: 'main' },
  { href: '/properties', label: 'נכסים', icon: '🏢', section: 'main' },
  { href: '/discovery', label: 'AI גילוי לידים', icon: '🤖', section: 'ai', badge: 'live' },
  { href: '/matching', label: 'AI התאמה', icon: '🎯', section: 'ai' },
  { href: '/search', label: 'חיפוש חכם', icon: '🔍', section: 'ai' },
  { href: '/agents', label: 'סוכנים', icon: '👤', section: 'agency' },
  { href: '/notifications', label: 'התראות', icon: '🔔', section: 'agency', badge: 'notif' },
  { href: '/settings', label: 'אינטגרציות', icon: '⚙️', section: 'agency' },
  { href: '/debug', label: 'אבחון מערכת', icon: '🔧', section: 'agency' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { leads, unreadCount } = useCRMStore()
  const hotCount = leads.filter(l => l.ai_score >= 80).length
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userInitial, setUserInitial] = useState('?')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata || {}
      const first = meta.first_name || meta.name?.split(' ')[0] || ''
      const last  = meta.last_name  || meta.name?.split(' ')[1] || ''
      const name  = `${first} ${last}`.trim() || user.email?.split('@')[0] || 'משתמש'
      setUserName(name)
      setUserRole(meta.role || 'agent')
      setUserInitial(name[0] || '?')
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'propflow_session=; path=/; max-age=0'
    router.replace('/login')
  }

  return (
    <aside className="w-56 bg-slate-900 border-r border-white/5 flex flex-col flex-shrink-0 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm">P</div>
        <div>
          <div className="font-bold text-sm">PropFlow CRM</div>
          <div className="text-xs text-slate-500">מנוע לידים AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {['main', 'ai', 'agency'].map(section => {
          const items = navItems.filter(i => i.section === section)
          const labels: Record<string, string> = { main: 'ראשי', ai: 'כלי AI', agency: 'סוכנות' }
          return (
            <div key={section} className="mb-4">
              <div className="text-xs text-slate-600 px-2 pb-1 uppercase tracking-wider">{labels[section]}</div>
              {items.filter(item => {
                  if (item.href === '/settings')   return canAccessSettings(userRole)
                  if (item.href === '/discovery')   return canRunDiscovery(userRole)
                  return true
                }).map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = item.badge === 'leads' ? (hotCount > 0 ? hotCount : null)
                  : item.badge === 'notif' ? (unreadCount() > 0 ? unreadCount() : null)
                  : item.badge === 'live' ? '●' : null
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-sm transition-all ${
                      active ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}>
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        item.badge === 'live' ? 'text-green-400 text-[10px]' :
                        'bg-red-500/80 text-white min-w-[18px] text-center'
                      }`}>{badge}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-white/5 space-y-1">
        <div className="flex items-center gap-2.5 p-2 rounded-lg glass">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{userName || '...'}</div>
            <div className="text-xs text-slate-500">{userRole}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-xs text-slate-500 hover:text-red-400 py-1.5 rounded-lg hover:bg-red-500/10 transition text-center"
        >
          יציאה מהמערכת
        </button>
      </div>
    </aside>
  )
}
