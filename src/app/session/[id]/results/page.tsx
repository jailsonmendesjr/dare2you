import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { ResultsClient } from './client'

export default async function ResultsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const sessionId = params.id

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(*)')
    .eq('id', sessionId)
    .single()

  if (!session) notFound()

  const { data: participants } = await supabase
    .from('session_participants')
    .select('*, session_results(*)')
    .eq('class_session_id', sessionId)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="text-center pt-10 pb-6 px-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-1">Resultado Oficial</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {session.daily_workouts.title}
        </h1>
        <p className="text-sm text-white/50 mt-1">{session.name}</p>
        {session.status !== 'finished' && (
          <span className="inline-block mt-2 text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-medium animate-pulse">
            AO VIVO
          </span>
        )}
      </div>

      <ResultsClient
        sessionId={sessionId}
        initialParticipants={participants || []}
        isLive={session.status !== 'finished'}
        timeCap={session.daily_workouts.time_cap_seconds}
      />
    </div>
  )
}
