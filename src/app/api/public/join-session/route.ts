import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const body = await request.json()
  
  if (!body.class_session_id || !body.display_name || !body.gender_category || !body.performance_category) {
    return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, box_id, status')
    .eq('id', body.class_session_id)
    .single()

  if (!session || session.status !== 'waiting') {
    return NextResponse.json({ error: 'Esta sessão não está aceitando novos participantes no momento.' }, { status: 403 })
  }

  const payload = {
    box_id: session.box_id,
    class_session_id: session.id,
    display_name: body.display_name,
    gender_category: body.gender_category,
    performance_category: body.performance_category,
    device_fingerprint: body.device_fingerprint || null,
    status: 'joined'
  }

  const { data, error } = await supabase
    .from('session_participants')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
