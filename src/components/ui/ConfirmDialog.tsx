'use client'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
}

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'אישור', confirmVariant = 'danger' }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" dir="rtl">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6">
          <p className="text-sm text-slate-200 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 glass rounded-xl text-sm text-slate-300 hover:text-white transition"
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
              confirmVariant === 'danger'
                ? 'bg-red-500/80 hover:bg-red-500 text-white'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
