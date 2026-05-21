'use client'
// components/layout/CRMLayout.tsx
import Sidebar from './Sidebar'

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden" dir="rtl">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  )
}
