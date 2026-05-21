'use client'
// components/layout/Topbar.tsx
import { useState } from 'react'
import Link from 'next/link'
import { useCRMStore } from '@/store/crm'

interface TopbarProps {
  title: string
  action?: { label: string; onClick: () => void }
}

export default function Topbar({ title, action }: TopbarProps) {
  const { searchQuery, setSearchQuery, unreadCount } = useCRMStore()
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const handleSearch = (v: string) => {
    setLocalSearch(v)
    setSearchQuery(v)
  }

  return (
    <div className="h-14 bg-slate-900 border-b border-white/5 flex items-center gap-3 px-5 flex-shrink-0">
      <h1 className="text-base font-semibold flex-1">{title}</h1>

      <div className="flex items-center gap-2 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 w-64">
        <span className="text-slate-500 text-sm">🔍</span>
        <input
          value={localSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder="חיפוש לידים, נכסים…"
          className="bg-transparent text-sm text-white placeholder-slate-500 outline-none flex-1 text-right"
          dir="rtl"
        />
      </div>

      {action && (
        <button onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm font-medium transition">
          <span>+</span>{action.label}
        </button>
      )}

      <Link href="/notifications"
        className="relative w-9 h-9 bg-slate-800 border border-white/10 rounded-lg flex items-center justify-center hover:bg-slate-700 transition">
        🔔
        {unreadCount() > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
      </Link>
    </div>
  )
}
