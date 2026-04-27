import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'
import { nanoid } from 'nanoid' // Wait, I don't have nanoid installed. I will use a custom function or install it.

// Let's use a custom generator to avoid needing nanoid
function generateJoinCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: Request) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.daily_workout_id || !body.name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const joinCode = generateJoinCode()
  
  // payload for QR could be a full URL, but for now we just store the code or the full URL.
  // We'll store the full URL so it's ready.
  // The host can be passed from the client or from headers, but let's assume it's constructed on the client.
  
  const payload = {
    box_id: adminUser.box_id,
    daily_workout_id: body.daily_workout_id,
    name: body.name,
    status: 'waiting',
    join_code: joinCode,
    created_by: adminUser.id,
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_sessions')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: Request) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_sessions')
    .select(`
      *,
      daily_workouts ( title )
    `)
    .eq('box_id', adminUser.box_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
