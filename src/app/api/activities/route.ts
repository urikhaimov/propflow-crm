// app/api/activities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const lead_id = req.nextUrl.searchParams.get('lead_id')
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ activities: [] })
  return NextResponse.json({ activities: data || [] })
}

export async function POST(req: NextRequest) {
  const { lead_id, type, content, metadata } = await req.json()

  if (!lead_id || !type) {
    return NextResponse.json({ error: 'lead_id and type are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('activities')
    .insert([{ lead_id, type, content, metadata }])
    .select()
    .single()

  if (error) {
    console.error('activities insert error:', error.message)
    return NextResponse.json({ activity: null })
  }
  return NextResponse.json({ activity: data })
}
