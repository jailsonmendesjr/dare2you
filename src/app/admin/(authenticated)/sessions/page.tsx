import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'
import { redirect } from 'next/navigation'
import { SessionsClient } from './client'

export default async function SessionsPage() {
  const { data: adminUser } = await getAdminUser()
  if (!adminUser) redirect('/admin/login')

  const supabase = await createClient()
  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('*, daily_workouts(title)')
    .eq('box_id', adminUser.box_id)
    .order('created_at', { ascending: false })

  const { data: workouts } = await supabase
    .from('daily_workouts')
    .select('id, title, status')
    .eq('box_id', adminUser.box_id)
    .order('event_date', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sessões</h2>
          <p className="text-muted-foreground">
            Inicie sessões ativas (turmas) para seus alunos acessarem via QR Code.
          </p>
        </div>
      </div>
      <SessionsClient initialSessions={sessions || []} workouts={workouts || []} />
    </div>
  )
}
