'use client'
// app/properties/page.tsx
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { StatusBadge, Spinner, EmptyState } from '@/components/ui'
import { useCRMStore } from '@/store/crm'
import { getProperties, createProperty, deleteProperty } from '@/lib/properties'
import { fmt } from '@/lib/utils'

const PROP_EMOJIS: Record<string, string> = {
  apartment: '🏢', villa: '🏡', penthouse: '🌆', studio: '🏠', commercial: '🏪', land: '🌿'
}

export default function PropertiesPage() {
  const { properties, setProperties, propertiesLoading, setPropertiesLoading } = useCRMStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', address: '', city: '', rooms: '', area: '', price: '', is_rental: false, property_type: 'apartment', status: 'available', owner_name: '' })

  useEffect(() => {
    async function load() {
      setPropertiesLoading(true)
      const data = await getProperties()
      setProperties(data)
      setPropertiesLoading(false)
    }
    load()
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const newProp = await createProperty({ ...form, rooms: Number(form.rooms), area: Number(form.area), price: Number(form.price) })
    setProperties([newProp, ...properties])
    setShowAdd(false)
    setForm({ title: '', address: '', city: '', rooms: '', area: '', price: '', is_rental: false, property_type: 'apartment', status: 'available', owner_name: '' })
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק נכס זה?')) return
    await deleteProperty(id)
    setProperties(properties.filter(p => p.id !== id))
  }

  return (
    <CRMLayout>
      <Topbar title={`נכסים (${properties.length})`} action={{ label: 'נכס חדש', onClick: () => setShowAdd(true) }} />

      {/* Add Property Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-bold">🏢 נכס חדש</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-5 grid grid-cols-2 gap-3">
              <input required placeholder="כותרת *" value={form.title} onChange={e => set('title', e.target.value)} className="col-span-2 input-field" />
              <input placeholder="כתובת" value={form.address} onChange={e => set('address', e.target.value)} className="input-field" />
              <input placeholder="עיר" value={form.city} onChange={e => set('city', e.target.value)} className="input-field" />
              <input type="number" placeholder="חדרים" value={form.rooms} onChange={e => set('rooms', e.target.value)} className="input-field" />
              <input type="number" placeholder="שטח (מ״ר)" value={form.area} onChange={e => set('area', e.target.value)} className="input-field" />
              <input type="number" placeholder="מחיר (₪)" value={form.price} onChange={e => set('price', e.target.value)} className="input-field col-span-2" />
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)} className="input-field">
                {['apartment','villa','penthouse','studio','commercial','land'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
                <option value="available">זמין</option>
                <option value="reserved">שמור</option>
                <option value="sold">נמכר</option>
                <option value="rented">מושכר</option>
              </select>
              <input placeholder="בעלים" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} className="input-field" />
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.is_rental} onChange={e => set('is_rental', e.target.checked)} className="accent-indigo-500" />
                להשכרה
              </label>
              <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="py-2.5 glass rounded-xl text-sm">ביטול</button>
                <button type="submit" className="py-2.5 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-sm font-semibold transition">שמור נכס</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5" dir="rtl">
        {propertiesLoading ? <Spinner /> : properties.length === 0 ? (
          <EmptyState icon="🏢" title="אין נכסים" desc="הוסיפו נכס ראשון למאגר" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {properties.map(p => (
              <div key={p.id} className="glass rounded-2xl overflow-hidden hover:bg-white/5 transition cursor-pointer group">
                {/* Thumbnail */}
                <div className="h-28 flex items-center justify-center text-5xl"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)' }}>
                  {PROP_EMOJIS[p.property_type] || '🏠'}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-sm">{p.title}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-slate-500 mb-2">📍 {p.address || p.city}</div>
                  <div className="flex gap-3 text-xs text-slate-400 mb-3">
                    {p.rooms && <span>🚪 {p.rooms} חד׳</span>}
                    {p.area && <span>📐 {p.area}מ״ר</span>}
                    {p.owner_name && <span>👤 {p.owner_name}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-base font-bold text-indigo-400">{fmt(p.price || 0, p.is_rental)}</div>
                    <button onClick={() => handleDelete(p.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition text-sm">מחק</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .input-field { padding: 0.625rem 0.75rem; background: rgb(30 41 59); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; font-size: 0.875rem; outline: none; color: white; width: 100%; }
        .input-field:focus { border-color: #6366f1; }
      `}</style>
    </CRMLayout>
  )
}
