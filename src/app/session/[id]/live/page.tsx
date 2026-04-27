import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { LiveWODClient } from './client'

export default async function LiveWODPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const sessionId = params.id

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(*)')
    .eq('id', sessionId)
    .single()

  if (!session) notFound()
  if (session.status === 'waiting') redirect(`/session/${sessionId}/waiting`)
  if (session.status === 'finished') redirect(`/session/${sessionId}/results`)

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full">
        <div className="text-center mb-8 mt-4">
          <p className="text-xl font-bold tracking-tight text-primary">{session.daily_workouts.title}</p>
          <p className="text-xs text-white/50">{session.name}</p>
        </div>
        
        <LiveWODClient session={session} />
      </div>
    </div>
  )
}
