import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const id = params.id

  const supabase = await createClient()

  // Verify the session belongs to the admin's box
  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, status')
    .eq('id', id)
    .eq('box_id', adminUser.box_id)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  if (session.status !== 'waiting') return NextResponse.json({ error: 'Sessão já foi iniciada ou encerrada' }, { status: 400 })

  const actualStartAt = new Date(Date.now() + 3000).toISOString()

  const { data, error } = await supabase
    .from('class_sessions')
    .update({ 
      status: 'live',
      actual_start_at: actualStartAt 
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
