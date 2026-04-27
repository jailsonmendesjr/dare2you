import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'

export async function GET(request: Request) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  const supabase = await createClient()
  let query = supabase
    .from('daily_workouts')
    .select('*')
    .eq('box_id', adminUser.box_id)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (date) {
    query = query.eq('event_date', date)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  
  if (!body.title || !body.event_date || !body.time_cap_seconds) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const payload = {
    box_id: adminUser.box_id,
    created_by: adminUser.id,
    title: body.title,
    description: body.description || null,
    workout_type: 'for_time',
    time_cap_seconds: parseInt(body.time_cap_seconds, 10),
    finish_button_initial_lock_enabled: body.finish_button_initial_lock_enabled || false,
    finish_button_initial_lock_seconds: body.finish_button_initial_lock_enabled ? 5 : 0,
    event_date: body.event_date,
    status: body.status || 'draft'
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_workouts')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
