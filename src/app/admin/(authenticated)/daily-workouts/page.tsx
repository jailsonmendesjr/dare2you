import { createClient } from '@/utils/supabase/server'
import { getAdminUser } from '@/utils/supabase/admin-user'
import { redirect } from 'next/navigation'
import { DailyWorkoutsClient } from './client'

export default async function DailyWorkoutsPage() {
  const { data: adminUser, error, userId } = await getAdminUser()
  
  if (!adminUser) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
        <h2 className="text-2xl font-bold text-destructive">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Sua conta está autenticada, mas você ainda não está vinculado a nenhum Box na tabela <strong>admin_users</strong>.
        </p>
        <div className="bg-muted p-4 rounded-md text-left text-sm font-mono mt-4">
          <p><strong>Debug Info:</strong></p>
          <p>User UID Atual: {userId}</p>
          <p>Erro Retornado: {error}</p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: workouts } = await supabase
    .from('daily_workouts')
    .select('*')
    .eq('box_id', adminUser.box_id)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Treinos do Dia</h2>
          <p className="text-muted-foreground">
            Gerencie os treinos programados para os seus alunos.
          </p>
        </div>
      </div>
      <DailyWorkoutsClient initialWorkouts={workouts || []} />
    </div>
  )
}
