// lib/properties.ts
import { supabase } from './supabase'
import type { Property } from '@/types'

export async function getProperties(): Promise<Property[]> {
  const { data, error } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Property[]
}

export async function createProperty(p: Partial<Property>): Promise<Property> {
  const { data, error } = await supabase.from('properties').insert([p]).select().single()
  if (error) throw error
  return data as Property
}

export async function updateProperty(id: string, updates: Partial<Property>): Promise<Property> {
  const { data, error } = await supabase.from('properties').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as Property
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
}
