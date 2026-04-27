import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'

/**
 * POST /api/admin/sessions/[id]/timeout
 *
 * Chamado automaticamente quando o time cap é atingido no painel do Coach.
 * 1. Encerra a sessão (status = 'finished', actual_end_at = now)
 * 2. Busca todos os participantes que ainda NÃO finalizaram
 * 3. Para cada um: cria session_result com DNF + atualiza status do participante
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const id = params.id
  const supabase = await createClient()

  // Busca a sessão e verifica posse
  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, status, box_id, actual_start_at, daily_workouts(time_cap_seconds)')
    .eq('id', id)
    .eq('box_id', adminUser.box_id)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  if (session.status !== 'live') {
    // Já foi encerrada por outra via — retorna 200 para não gerar erro no cliente
    return NextResponse.json({ message: 'Sessão já encerrada' }, { status: 200 })
  }

  const now = new Date()
  const startAt = new Date(session.actual_start_at).getTime()
  const timeCapMs = (session.daily_workouts as any).time_cap_seconds * 1000
  const elapsedMs = timeCapMs // todos os que não finalizaram recebem exatamente o time cap

  // 1. Encerra a sessão
  const { error: sessionError } = await supabase
    .from('class_sessions')
    .update({ status: 'finished', actual_end_at: now.toISOString() })
    .eq('id', id)

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

  // 2. Busca participantes ainda sem resultado (não clicaram em ACABEI)
  const { data: pendingParticipants } = await supabase
    .from('session_participants')
    .select('id, box_id')
    .eq('class_session_id', id)
    .neq('status', 'finished')

  if (pendingParticipants && pendingParticipants.length > 0) {
    // 3a. Cria DNF para cada participante pendente (ignora se já existir)
    const dnfResults = pendingParticipants.map((p) => ({
      box_id: p.box_id,
      class_session_id: id,
      session_participant_id: p.id,
      result_type: 'dnf',
      finished_at: now.toISOString(),
      elapsed_ms: elapsedMs,
      source: 'system_timeout',
    }))

    await supabase
      .from('session_results')
      .upsert(dnfResults, { onConflict: 'session_participant_id', ignoreDuplicates: true })

    // 3b. Atualiza status dos participantes pendentes para 'dnf'
    await supabase
      .from('session_participants')
      .update({ status: 'dnf' })
      .in('id', pendingParticipants.map((p) => p.id))
  }

  return NextResponse.json({ message: 'Sessão encerrada por time cap', pendingCount: pendingParticipants?.length ?? 0 })
}
