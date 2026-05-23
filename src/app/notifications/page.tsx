'use client'
// app/notifications/page.tsx
import { useEffect } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { useCRMStore } from '@/store/crm'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'
import { timeAgo } from '@/lib/utils'

const TYPE_CONFIG: Record<string, { icon: string; bg: string; color: string }> = {
  hot_lead:  { icon: '🔥', bg: 'bg-red-500/10',    color: 'text-red-400' },
  match:     { icon: '⚡', bg: 'bg-indigo-500/10', color: 'text-indigo-400' },
  seller:    { icon: '🏡', bg: 'bg-green-500/10',  color: 'text-green-400' },
  crawler:   { icon: '🤖', bg: 'bg-purple-500/10', color: 'text-purple-400' },
  system:    { icon: '🔔', bg: 'bg-amber-500/10',  color: 'text-amber-400' },
}

// Seed mock notifications if none exist
const MOCK_NOTIFS: Partial<Notification>[] = [
  { type: 'hot_lead',  title: 'ליד חם חדש זוהה', body: 'עומר שפירו — 4 חד׳ ת"א, תקציב 3.5M ₪. מקור: פייסבוק', is_read: false },
  { type: 'match',     title: 'התאמת AI: 94%', body: 'אבי מזרחי ↔ פנטהאוז הירקון — ציון תאימות 94%', is_read: false },
  { type: 'seller',    title: 'מוכר מוטיבציה גבוהה', body: 'שרה אברמוביץ — וילה הרצליה פיתוח, 7M ₪', is_read: false },
  { type: 'crawler',   title: 'AI Crawler מצא לידים', body: '8 לידים חדשים מיד2 ופייסבוק בשעה האחרונה', is_read: false },
  { type: 'hot_lead',  title: 'שוכר דחוף', body: 'רוני פרץ זקוק ל-2 חד׳ בירושלים עד 1.7. ציון AI: 72', is_read: true },
  { type: 'system',    title: '3 לידים חדשים מ-Reddit', body: 'קונים באזור רעננה זוהו בקהילת r/Israel', is_read: true },
  { type: 'match',     title: 'נכס מתאים זוהה', body: 'שירה טל סגרה עסקה ברוטשילד — ₪4.8M עמלה', is_read: true },
]

export default function NotificationsPage() {
  const { notifications, setNotifications, markNotificationRead } = useCRMStore()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
      if (data && data.length > 0) {
        setNotifications(data as Notification[])
      } else {
        // Use mock data with fake ids
        const mocks = MOCK_NOTIFS.map((n, i) => ({
          ...n,
          id: `mock-${i}`,
          agent_id: 'mock',
          created_at: new Date(Date.now() - i * 3600000).toISOString(),
        })) as Notification[]
        setNotifications(mocks)
      }
    }
    load()
  }, [])

  async function markAllRead() {
    setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
  }

  async function markRead(id: string) {
    markNotificationRead(id)
    if (!id.startsWith('mock')) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    }
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <CRMLayout>
      <Topbar title={`התראות${unread > 0 ? ` (${unread})` : ''}`} action={{ label: 'סמן הכל כנקרא', onClick: markAllRead }} />
      <div className="flex-1 overflow-y-auto p-3 md:p-5" dir="rtl">

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {['הכל', 'לידים חמים', 'התאמות', 'סורק AI', 'מערכת'].map(tab => (
            <button key={tab} className="px-3 py-1.5 text-xs rounded-lg glass hover:bg-white/5 transition text-slate-400 hover:text-white">
              {tab}
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {notifications.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">🔔</div>
              <div>אין התראות</div>
            </div>
          )}
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
            return (
              <div key={n.id} onClick={() => markRead(n.id)}
                className={`flex items-start gap-3 p-4 border-b border-white/3 cursor-pointer hover:bg-white/3 transition ${!n.is_read ? 'border-r-2 border-r-indigo-500' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${cfg.bg}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${!n.is_read ? 'text-white' : 'text-slate-400'}`}>{n.title}</div>
                  {n.body && <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>}
                  <div className="text-xs text-slate-600 mt-1">{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}
              </div>
            )
          })}
        </div>
      </div>
    </CRMLayout>
  )
}
