import { createClient } from './server'

export async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { data: null, error: 'No authenticated user', userId: null }

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('id, box_id, role, status')
    .eq('auth_user_id', user.id)
    .single()

  if (!adminUser) return { data: null, error: error?.message || 'Admin user not found', userId: user.id }

  return { data: adminUser, error: null, userId: user.id }
}
