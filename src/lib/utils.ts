// lib/utils.ts

export function fmt(n?: number | null, isRental = false): string {
  if (!n) return '—'
  if (isRental) return `₪${n.toLocaleString('he-IL')}/חודש`
  if (n >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₪${Math.round(n / 1_000)}K`
  return `₪${n}`
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#f59e0b'
  return '#64748b'
}

export function intentLabel(intent: string): string {
  const map: Record<string, string> = {
    buyer: 'קונה', seller: 'מוכר', renter: 'שוכר', investor: 'משקיע'
  }
  return map[intent] || intent
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'חדש', contacted: 'יצרנו קשר', qualified: 'מוסמך',
    negotiating: 'במשא ומתן', won: 'נסגר', lost: 'אבד',
    available: 'זמין', reserved: 'שמור', sold: 'נמכר', rented: 'מושכר'
  }
  return map[status] || status
}

export function intentColor(intent: string): string {
  const map: Record<string, string> = {
    buyer: '#4f6ef7', seller: '#22c55e', renter: '#f59e0b', investor: '#a855f7'
  }
  return map[intent] || '#64748b'
}

export function initials(firstName: string, lastName?: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דק׳`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `לפני ${hours} שע׳`
  return `לפני ${Math.floor(hours / 24)} יום`
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
