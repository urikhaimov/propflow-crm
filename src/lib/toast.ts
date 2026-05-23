'use client'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'
export interface Toast { id: string; message: string; type: ToastType }

let toasts: Toast[] = []
const listeners = new Set<(t: Toast[]) => void>()
function emit() { listeners.forEach(fn => fn([...toasts])) }

function add(message: string, type: ToastType) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, message, type }]
  emit()
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emit() }, 3500)
}

export const toast = {
  success: (message: string) => add(message, 'success'),
  error:   (message: string) => add(message, 'error'),
  info:    (message: string) => add(message, 'info'),
}

export function useToasts() {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => {
    listeners.add(setList)
    return () => { listeners.delete(setList) }
  }, [])
  return list
}
