'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PlusCircle, Pencil, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'

export function DailyWorkoutsClient({ initialWorkouts }: { initialWorkouts: any[] }) {
  const router = useRouter()
  const [workouts, setWorkouts] = useState(initialWorkouts)
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [timeCap, setTimeCap] = useState('10')
  const [lockEnabled, setLockEnabled] = useState(false)
  const [status, setStatus] = useState('draft')

  const openNew = () => {
    setIsEditing(null)
    setTitle('')
    setDescription('')
    setEventDate(format(new Date(), 'yyyy-MM-dd'))
    setTimeCap('10')
    setLockEnabled(false)
    setStatus('draft')
    setIsOpen(true)
  }

  const openEdit = (w: any) => {
    setIsEditing(w)
    setTitle(w.title)
    setDescription(w.description || '')
    setEventDate(w.event_date)
    setTimeCap((w.time_cap_seconds / 60).toString())
    setLockEnabled(w.finish_button_initial_lock_enabled)
    setStatus(w.status)
    setIsOpen(true)
  }

  const handleSave = async () => {
    setIsLoading(true)
    const payload = {
      title,
      description,
      event_date: eventDate,
      time_cap_seconds: parseInt(timeCap, 10) * 60,
      finish_button_initial_lock_enabled: lockEnabled,
      status
    }

    try {
      if (isEditing) {
        const res = await fetch(`/api/admin/daily-workouts/${isEditing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const updated = await res.json()
          setWorkouts(workouts.map(w => w.id === updated.id ? updated : w))
          toast.success('Treino atualizado com sucesso!')
        } else {
          toast.error('Erro ao atualizar treino')
        }
      } else {
        const res = await fetch('/api/admin/daily-workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const created = await res.json()
          setWorkouts([created, ...workouts])
          toast.success('Treino criado com sucesso!')
        } else {
          toast.error('Erro ao criar treino')
        }
      }
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={<Button onClick={openNew} />}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Treino
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Editar Treino' : 'Novo Treino'}</DialogTitle>
              <DialogDescription>
                Configure os detalhes do treino do dia (WOD).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título do Treino</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Murph, Fran, WOD 10/10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Data</Label>
                  <Input id="date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="timeCap">Time Cap (Minutos)</Label>
                  <Input id="timeCap" type="number" value={timeCap} onChange={e => setTimeCap(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(val) => setStatus(val || 'draft')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho (Draft)</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label>Trava Inicial (5s)</Label>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia o botão de finalizar nos primeiros 5 segundos para evitar toques acidentais (US-004).
                  </p>
                </div>
                <Switch checked={lockEnabled} onCheckedChange={setLockEnabled} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isLoading || !title || !eventDate || !timeCap}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Time Cap</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum treino encontrado. Crie o primeiro!
                </TableCell>
              </TableRow>
            ) : workouts.map(w => (
              <TableRow key={w.id}>
                <TableCell>{format(new Date(w.event_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="font-medium">{w.title}</TableCell>
                <TableCell>{Math.floor(w.time_cap_seconds / 60)} min {w.time_cap_seconds % 60}s</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    w.status === 'published' ? 'bg-primary/10 text-primary' : 
                    w.status === 'draft' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {w.status === 'published' ? 'Publicado' : w.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(w)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Ranking Geral" nativeButton={false} render={<Link href={`/workout/${w.id}/ranking`} />}>
                    <Trophy className="h-4 w-4 text-yellow-500" />
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
