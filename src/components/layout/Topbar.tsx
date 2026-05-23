'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useCRMStore } from '@/store/crm'

interface TopbarProps {
  title: string
  action?: { label: string; onClick: () => void }
}

export default function Topbar({ title, action }: TopbarProps) {
  const { searchQuery, setSearchQuery, unreadCount, sidebarOpen, setSidebarOpen } = useCRMStore()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleSearch = (v: string) => {
    setLocalSearch(v)
    setSearchQuery(v)
  }

  return (
    <div className="relative h-14 bg-slate-900 border-b border-white/5 flex items-center gap-2 px-4 flex-shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition flex-shrink-0"
        aria-label="פתח תפריט"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
          <rect x="0" y="2" width="18" height="2" rx="1"/>
          <rect x="0" y="8" width="18" height="2" rx="1"/>
          <rect x="0" y="14" width="18" height="2" rx="1"/>
        </svg>
      </button>

      <h1 className="text-base font-semibold flex-1 truncate">{title}</h1>

      {/* Search — full on desktop, icon+expand on mobile */}
      <div className="hidden sm:flex items-center gap-2 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 w-56">
        <span className="text-slate-500 text-sm">🔍</span>
        <input
          value={localSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder="חיפוש לידים, נכסים…"
          className="bg-transparent text-sm text-white placeholder-slate-500 outline-none flex-1 text-right"
          dir="rtl"
        />
      </div>

      {/* Mobile search toggle */}
      {searchOpen && (
        <div className="sm:hidden absolute top-14 right-0 left-0 bg-slate-900 border-b border-white/5 px-4 py-2.5 z-20">
          <input
            autoFocus
            value={localSearch}
            onChange={e => handleSearch(e.target.value)}
            onBlur={() => { if (!localSearch) setSearchOpen(false) }}
            placeholder="חיפוש לידים, נכסים…"
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none text-right"
            dir="rtl"
          />
        </div>
      )}
      <button
        onClick={() => setSearchOpen(s => !s)}
        className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
        aria-label="חיפוש"
      >
        🔍
      </button>

      {action && (
        <button onClick={action.onClick}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm font-medium transition flex-shrink-0">
          <span>+</span>
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      )}

      <Link href="/notifications"
        className="relative w-9 h-9 bg-slate-800 border border-white/10 rounded-lg flex items-center justify-center hover:bg-slate-700 transition flex-shrink-0">
        🔔
        {unreadCount() > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
      </Link>
    </div>
  )
}
