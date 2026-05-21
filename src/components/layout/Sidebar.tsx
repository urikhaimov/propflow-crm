'use client'
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCRMStore } from '@/store/crm'

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
]

export default function Sidebar() {
  const pathname = usePathname()
  const { leads, unreadCount } = useCRMStore()
  const hotCount = leads.filter(l => l.ai_score >= 80).length

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
              {items.map(item => {
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

      {/* Agent footer */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 p-2 rounded-lg glass cursor-pointer hover:bg-white/5 transition">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">ד</div>
          <div>
            <div className="text-xs font-medium">דנה לוי</div>
            <div className="text-xs text-slate-500">סוכן בכיר</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
