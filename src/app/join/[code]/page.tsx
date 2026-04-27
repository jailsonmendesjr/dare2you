import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { JoinClient } from './client'

export default async function JoinPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params
  const code = params.code

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(title, description)')
    .eq('join_code', code)
    .single()

  if (!session) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">Round Count</h1>
          <p className="mt-2 text-xl font-medium">{session.daily_workouts.title}</p>
          <p className="text-sm text-muted-foreground">{session.name}</p>
        </div>
        <JoinClient session={session} />
      </div>
    </div>
  )
}
