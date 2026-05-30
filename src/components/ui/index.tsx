// components/ui/index.tsx
import { intentColor, intentLabel, statusLabel, scoreColor } from '@/lib/utils'

// ─── BADGE ────────────────────────────────────────────────────
export function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    buyer: 'bg-indigo-500/15 text-indigo-300',
    seller: 'bg-green-500/15 text-green-300',
    renter: 'bg-amber-500/15 text-amber-300',
    investor: 'bg-purple-500/15 text-purple-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[intent] || 'bg-slate-700 text-slate-300'}`}>
      {intentLabel(intent)}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-sky-500/15 text-sky-300',
    contacted: 'bg-blue-500/15 text-blue-300',
    qualified: 'bg-amber-500/15 text-amber-300',
    negotiating: 'bg-orange-500/15 text-orange-300',
    won: 'bg-green-500/15 text-green-300',
    lost: 'bg-slate-700 text-slate-400',
    available: 'bg-green-500/15 text-green-300',
    reserved: 'bg-amber-500/15 text-amber-300',
    sold: 'bg-slate-700 text-slate-400',
    rented: 'bg-purple-500/15 text-purple-300',
    hot: 'bg-red-500/15 text-red-300',
    warm: 'bg-amber-500/15 text-amber-300',
    cold: 'bg-slate-700 text-slate-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-700 text-slate-300'}`}>
      {statusLabel(status)}
    </span>
  )
}

// ─── SCORE BAR ────────────────────────────────────────────────
export function ScoreBar({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#64748b'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[40px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      {showLabel && <span className="text-xs font-semibold" style={{ color }}>{score}</span>}
    </div>
  )
}

// ─── AVATAR ───────────────────────────────────────────────────
export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ background: color || '#4f6ef7', color: '#fff' }}>
      {initials}
    </div>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="glass p-4 rounded-2xl hover:bg-white/5 transition cursor-default">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

// ─── AI BOX ───────────────────────────────────────────────────
export function AIBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
      <div className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1.5">🤖 {title}</div>
      <div className="text-xs text-slate-300 leading-relaxed">{children}</div>
    </div>
  )
}

// ─── LOADING SPINNER ──────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────
export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-lg font-semibold mb-2">{title}</div>
      <div className="text-slate-500 text-sm">{desc}</div>
    </div>
  )
}

// ─── LOCAL-ONLY BADGE ─────────────────────────────────────────
export function LocalOnlyBadge() {
  return (
    <span
      title="פיצ׳ר זה מחייב הפעלה מקומית (npm run dev). בפריסת Vercel הדפדפן רץ על השרת שלהם, לא על המחשב שלך — ולכן אין גישה לחשבון הפייסבוק/טלגרם שלך."
      className="text-xs px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full cursor-help select-none">
      מקומי בלבד
    </span>
  )
}

// ─── SECTION TITLE ────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-white/5">
      {children}
    </div>
  )
}
