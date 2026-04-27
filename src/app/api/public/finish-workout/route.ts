import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const body = await request.json()
  
  if (!body.class_session_id || !body.session_participant_id) {
    return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify session status is live
  const { data: session } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(*)')
    .eq('id', body.class_session_id)
    .single()

  if (!session || session.status !== 'live') {
    return NextResponse.json({ error: 'Sessão não está ativa.' }, { status: 403 })
  }

  // Check if participant already has a result (prevent duplicate key error)
  const { data: existing } = await supabase
    .from('session_results')
    .select('id, elapsed_ms')
    .eq('session_participant_id', body.session_participant_id)
    .maybeSingle()

  if (existing) {
    // Already registered — return existing result silently
    return NextResponse.json(existing, { status: 200 })
  }

  // Calculate elapsed time securely on the server
  const startAt = new Date(session.actual_start_at).getTime()
  const now = Date.now()
  let elapsedMs = now - startAt

  // Cap elapsed if they click after timecap
  const timeCapMs = session.daily_workouts.time_cap_seconds * 1000
  const resultType = elapsedMs > timeCapMs ? 'dnf' : 'finished'
  
  if (elapsedMs > timeCapMs) {
     elapsedMs = timeCapMs
  }

  const payload = {
    box_id: session.box_id,
    class_session_id: session.id,
    session_participant_id: body.session_participant_id,
    result_type: resultType,
    finished_at: new Date(now).toISOString(),
    elapsed_ms: Math.max(0, elapsedMs),
    source: 'participant_click'
  }

  const { data, error } = await supabase
    .from('session_results')
    .upsert(payload, { onConflict: 'session_participant_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update participant status to match the result type
  await supabase
    .from('session_participants')
    .update({ status: resultType === 'dnf' ? 'dnf' : 'finished' })
    .eq('id', body.session_participant_id)

  return NextResponse.json(data, { status: 201 })
}
