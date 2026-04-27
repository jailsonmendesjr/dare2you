'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, PlusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'

export function SessionsClient({ initialSessions, workouts }: { initialSessions: any[], workouts: any[] }) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [name, setName] = useState('')
  const [workoutId, setWorkoutId] = useState('')

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, daily_workout_id: workoutId })
      })
      if (res.ok) {
        const created = await res.json()
        const workout = workouts.find(w => w.id === created.daily_workout_id)
        setSessions([{ ...created, daily_workouts: { title: workout?.title } }, ...sessions])
        setIsOpen(false)
        setName('')
        setWorkoutId('')
        toast.success('Sessão iniciada com sucesso!')
      } else {
        toast.error('Erro ao iniciar sessão')
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={<Button />}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Sessão
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nova Sessão</DialogTitle>
              <DialogDescription>
                Selecione o treino do dia para abrir uma sala e gerar o código de acesso para a turma.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="workout">Treino do Dia</Label>
                <Select value={workoutId} onValueChange={(v) => setWorkoutId(v || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o treino" />
                  </SelectTrigger>
                  <SelectContent>
                    {workouts.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.title} {w.status === 'draft' ? '(Rascunho)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Nome da Turma</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Turma das 18h, Aulão de Sábado" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isLoading || !name || !workoutId}>
                {isLoading ? 'Iniciando...' : 'Iniciar Sessão'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Treino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhuma sessão ativa. Inicie uma nova sessão para receber alunos.
                </TableCell>
              </TableRow>
            ) : sessions.map(s => (
              <TableRow key={s.id}>
                <TableCell>{format(new Date(s.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.daily_workouts?.title}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    s.status === 'live' ? 'bg-red-500/10 text-red-500' : 
                    s.status === 'waiting' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {s.status.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono bg-muted px-2 py-1 rounded text-sm tracking-wider">{s.join_code}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Abrir Painel" nativeButton={false} render={<Link href={`/admin/sessions/${s.id}`} />}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
