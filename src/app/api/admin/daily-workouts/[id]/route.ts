import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const id = params.id
  const body = await request.json()
  
  const payload: any = {}
  if (body.title !== undefined) payload.title = body.title
  if (body.description !== undefined) payload.description = body.description
  if (body.time_cap_seconds !== undefined) payload.time_cap_seconds = parseInt(body.time_cap_seconds, 10)
  if (body.finish_button_initial_lock_enabled !== undefined) {
    payload.finish_button_initial_lock_enabled = body.finish_button_initial_lock_enabled
    payload.finish_button_initial_lock_seconds = body.finish_button_initial_lock_enabled ? 5 : 0
  }
  if (body.event_date !== undefined) payload.event_date = body.event_date
  if (body.status !== undefined) payload.status = body.status

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_workouts')
    .update(payload)
    .eq('id', id)
    .eq('box_id', adminUser.box_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
