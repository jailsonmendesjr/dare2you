import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { WorkoutRankingClient } from './client'

export default async function WorkoutRankingPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const workoutId = params.id

  const supabase = await createClient()

  // Buscar o treino do dia
  const { data: workout } = await supabase
    .from('daily_workouts')
    .select('*')
    .eq('id', workoutId)
    .single()

  if (!workout) notFound()

  // Buscar todas as sessões deste treino
  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('id, name')
    .eq('daily_workout_id', workoutId)

  const sessionIds = sessions?.map(s => s.id) || []

  // Buscar todos os participantes e resultados dessas sessões
  let participants: any[] = []
  if (sessionIds.length > 0) {
    const { data: p } = await supabase
      .from('session_participants')
      .select('*, session_results(*), class_sessions(name)')
      .in('class_session_id', sessionIds)
      .order('created_at', { ascending: true })
    
    participants = p || []
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="text-center pt-10 pb-6 px-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-1">Ranking Geral</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {workout.title}
        </h1>
        <p className="text-sm text-white/50 mt-1">Consolidado de todas as turmas</p>
      </div>

      <WorkoutRankingClient
        workoutId={workoutId}
        initialParticipants={participants}
        timeCap={workout.time_cap_seconds}
        sessionIds={sessionIds}
      />
    </div>
  )
}
