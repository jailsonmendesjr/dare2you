import { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dumbbell, Users, Activity, LogOut, Menu } from 'lucide-react'

export default async function AuthenticatedAdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/admin/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2 font-semibold md:text-lg">
          <Activity className="h-6 w-6 text-primary" />
          <span>Round Count <span className="text-muted-foreground text-sm font-normal ml-1">Admin</span></span>
        </div>
        <nav className="hidden md:flex flex-1 items-center gap-6 ml-6 text-sm font-medium">
          <Link href="/admin/daily-workouts" className="flex items-center gap-2 text-foreground transition-colors hover:text-primary">
            <Dumbbell className="h-4 w-4" />
            Treinos do Dia
          </Link>
          <Link href="/admin/sessions" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary">
            <Users className="h-4 w-4" />
            Sessões
          </Link>
        </nav>
        <div className="flex items-center gap-2 md:gap-4 ml-auto">
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu principal</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/admin/daily-workouts" className="flex items-center gap-2 cursor-pointer w-full">
                    <Dumbbell className="h-4 w-4" />
                    Treinos do Dia
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/sessions" className="flex items-center gap-2 cursor-pointer w-full">
                    <Users className="h-4 w-4" />
                    Sessões
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <span className="text-sm text-muted-foreground hidden sm:inline-block">{user.email}</span>
          <form action="/api/admin/logout" method="POST">
            <Button variant="ghost" size="icon" type="submit" title="Sair">
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Sair</span>
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
