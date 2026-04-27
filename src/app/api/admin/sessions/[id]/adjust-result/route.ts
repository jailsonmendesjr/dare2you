import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'

/**
 * PATCH /api/admin/sessions/[id]/adjust-result
 * Body: { participant_id: string, elapsed_ms: number, result_type: 'finished' | 'dnf', notes?: string }
 *
 * Permite ao Coach corrigir manualmente o tempo de um participante.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const sessionId = params.id

  const body = await request.json()
  const { participant_id, elapsed_ms, result_type, notes } = body

  if (!participant_id || elapsed_ms == null || !result_type) {
    return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify session belongs to admin's box
  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, box_id')
    .eq('id', sessionId)
    .eq('box_id', adminUser.box_id)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Get previous result snapshot
  const { data: previousResult } = await supabase
    .from('session_results')
    .select('*')
    .eq('session_participant_id', participant_id)
    .single()

  // Upsert result (create if doesn't exist, update if exists)
  const { data: result, error: resultError } = await supabase
    .from('session_results')
    .upsert(
      {
        box_id: session.box_id,
        class_session_id: sessionId,
        session_participant_id: participant_id,
        result_type,
        elapsed_ms,
        finished_at: new Date().toISOString(),
        source: 'coach_manual_adjustment',
        is_manual_override: true,
        notes: notes || null,
      },
      { onConflict: 'session_participant_id' }
    )
    .select()
    .single()

  if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 })

  // Log adjustment for audit
  if (result) {
    await supabase.from('result_adjustments').insert({
      box_id: session.box_id,
      class_session_id: sessionId,
      session_result_id: result.id,
      adjusted_by: adminUser.id,
      previous_result_snapshot: previousResult || {},
      new_result_snapshot: result,
      reason: notes || 'Ajuste manual sem observação'
    })
  }

  // Update participant status to match result type
  await supabase
    .from('session_participants')
    .update({ status: result_type === 'dnf' ? 'dnf' : 'finished' })
    .eq('id', participant_id)

  return NextResponse.json(result)
}
