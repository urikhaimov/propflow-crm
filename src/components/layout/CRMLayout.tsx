'use client'
import Sidebar from './Sidebar'
import Toaster from '@/components/ui/Toaster'

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden" dir="rtl">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>
      <Toaster />
    </div>
  )
}
