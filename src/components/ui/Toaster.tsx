'use client'
import { useToasts } from '@/lib/toast'

export default function Toaster() {
  const toasts = useToasts()
  if (!toasts.length) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium
            border backdrop-blur-sm animate-in slide-in-from-top-2 fade-in duration-200
            ${t.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-300' :
              t.type === 'error'   ? 'bg-red-500/15   border-red-500/30   text-red-300'   :
                                     'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'}
          `}
        >
          <span className="text-base leading-none">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
