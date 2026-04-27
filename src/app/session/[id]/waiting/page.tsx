import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { WaitingRoomClient } from './client'

export default async function WaitingRoomPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const sessionId = params.id

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(title)')
    .eq('id', sessionId)
    .single()

  if (!session) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <WaitingRoomClient sessionId={sessionId} />
      <div className="w-full max-w-md text-center space-y-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">Round Count</h1>
        
        <div className="space-y-4">
          <p className="text-xl font-medium">{session.daily_workouts.title}</p>
          <div className="animate-pulse bg-white/10 p-6 rounded-2xl">
            <h2 className="text-2xl font-bold mb-2">Aguarde...</h2>
            <p className="text-gray-400 text-sm">O Coach iniciará o cronômetro em breve.</p>
          </div>
        </div>

        <p className="text-xs text-gray-600">Mantenha esta tela aberta.</p>
      </div>
    </div>
  )
}
