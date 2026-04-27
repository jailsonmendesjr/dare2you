import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'
import { redirect } from 'next/navigation'
import { SessionDetailClient } from './client'

export default async function SessionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = params.id
  
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) redirect('/admin/login')

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(*)')
    .eq('id', id)
    .eq('box_id', adminUser.box_id)
    .single()

  if (!session) redirect('/admin/sessions')

  const { data: participants } = await supabase
    .from('session_participants')
    .select('*, session_results(*)')
    .eq('class_session_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{session.name}</h2>
          <p className="text-muted-foreground">
            Treino: {session.daily_workouts.title}
          </p>
        </div>
      </div>
      <SessionDetailClient initialSession={session} initialParticipants={participants || []} />
    </div>
  )
}
