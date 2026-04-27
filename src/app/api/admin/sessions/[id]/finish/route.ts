import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const id = params.id

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, status, box_id')
    .eq('id', id)
    .eq('box_id', adminUser.box_id)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  if (session.status !== 'live') return NextResponse.json({ error: 'Sessão não está ao vivo' }, { status: 400 })

  const { data, error } = await supabase
    .from('class_sessions')
    .update({ status: 'finished', actual_end_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
