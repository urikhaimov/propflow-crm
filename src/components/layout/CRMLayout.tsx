'use client'
import Sidebar from './Sidebar'
import Toaster from '@/components/ui/Toaster'
import { useCRMStore } from '@/store/crm'

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useCRMStore()

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden" dir="rtl">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>

      <Toaster />
    </div>
  )
}
