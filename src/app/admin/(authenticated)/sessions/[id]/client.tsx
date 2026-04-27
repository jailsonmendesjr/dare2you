'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlayCircle, StopCircle, Pencil, BarChart2, Info } from 'lucide-react'
import QRCode from 'react-qr-code'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'

export function SessionDetailClient({ initialSession, initialParticipants }: { initialSession: any, initialParticipants: any[] }) {
  const supabase = createClient()
  const [session, setSession] = useState(initialSession)
  const [participants, setParticipants] = useState(() => 
    initialParticipants.map(p => ({
      ...p,
      session_results: Array.isArray(p.session_results) 
        ? p.session_results 
        : (p.session_results ? [p.session_results] : [])
    }))
  )
  const [isLoading, setIsLoading] = useState(false)
  const [now, setNow] = useState(Date.now())
  const timeoutFiredRef = useRef(false)

  // Adjust result modal state
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null)
  const [adjustTime, setAdjustTime] = useState('')   // mm:ss
  const [adjustType, setAdjustType] = useState<'finished' | 'dnf'>('finished')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${origin}/join/${session.join_code}`

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`coach_session_${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_sessions', filter: `id=eq.${session.id}` },
        (payload) => setSession((prev: any) => ({ ...prev, ...payload.new }))
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_participants', filter: `class_session_id=eq.${session.id}` },
        (payload) => setParticipants((prev: any[]) => [...prev, { ...payload.new, session_results: [] }])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_participants', filter: `class_session_id=eq.${session.id}` },
        (payload) => setParticipants((prev: any[]) =>
          prev.map((p) => p.id === payload.new.id ? { ...p, ...payload.new } : p)
        )
      )
      .on(
        'postgres_changes',
        // No filter on session_results because the filter needs to match an indexed column
        // We manually filter by class_session_id inside the handler
        { event: 'INSERT', schema: 'public', table: 'session_results' },
        (payload) => {
          if (payload.new.class_session_id !== session.id) return
          setParticipants((prev: any[]) =>
            prev.map((p) =>
              p.id === payload.new.session_participant_id
                ? { ...p, session_results: [payload.new] }
                : p
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_results' },
        (payload) => {
          if (payload.new.class_session_id !== session.id) return
          setParticipants((prev: any[]) =>
            prev.map((p) =>
              p.id === payload.new.session_participant_id
                ? { ...p, session_results: [payload.new] }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [session.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stopwatch tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (session.status !== 'live' || !session.actual_start_at) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [session.status, session.actual_start_at])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/start`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao iniciar')
      toast.success('Treino iniciado! Contagem regressiva em andamento.')
    } catch {
      toast.error('Erro ao iniciar sessão.')
    } finally {
      setIsLoading(false)
    }
  }, [session.id])

  const handleFinish = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/finish`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao finalizar')
      toast.success('Sessão encerrada!')
    } catch {
      toast.error('Erro ao encerrar sessão.')
    } finally {
      setIsLoading(false)
    }
  }, [session.id])

  const openAdjust = (participant: any) => {
    const result = participant.session_results?.[0]
    setAdjustTarget(participant)
    setAdjustType(result?.result_type === 'dnf' ? 'dnf' : 'finished')
    const ms = result?.elapsed_ms ?? 0
    const m = Math.floor(ms / 60000).toString().padStart(2, '0')
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
    setAdjustTime(`${m}:${s}`)
    setAdjustNotes(result?.notes || '')
  }

  const handleAdjustSave = async () => {
    if (!adjustTarget) return
    const [mStr, sStr] = adjustTime.split(':')
    const m = parseInt(mStr || '0', 10)
    const s = parseInt(sStr || '0', 10)
    if (isNaN(m) || isNaN(s)) { toast.error('Formato inválido. Use mm:ss'); return }
    const elapsed_ms = (m * 60 + s) * 1000
    setIsAdjusting(true)
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/adjust-result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: adjustTarget.id,
          elapsed_ms,
          result_type: adjustType,
          notes: adjustNotes
        })
      })
      if (!res.ok) throw new Error('Erro')
      toast.success('Resultado ajustado com sucesso!')
      setAdjustTarget(null)
    } catch {
      toast.error('Erro ao ajustar resultado.')
    } finally {
      setIsAdjusting(false)
    }
  }

  // ── Derived time values ─────────────────────────────────────────────────────
  const timeCap = session.daily_workouts?.time_cap_seconds
  const startAt = session.actual_start_at ? new Date(session.actual_start_at).getTime() : null
  const diffMs = startAt ? now - startAt : -Infinity
  const isTimeCapped = session.status === 'live' && startAt != null && diffMs >= timeCap * 1000

  let stopwatch = '00:00'
  let countdownMsg = ''

  if (session.status === 'live' && session.actual_start_at) {
    if (diffMs < 0) {
      countdownMsg = `Iniciando em ${Math.ceil(Math.abs(diffMs) / 1000)}...`
    } else {
      const total = Math.floor(diffMs / 1000)
      stopwatch = `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`
    }
  }

  // ── Auto-timeout when time cap is reached ───────────────────────────────────
  useEffect(() => {
    if (!isTimeCapped || timeoutFiredRef.current) return
    timeoutFiredRef.current = true
    fetch(`/api/admin/sessions/${session.id}/timeout`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.pendingCount > 0) {
          toast.info(`Time cap atingido! ${data.pendingCount} atleta(s) registrado(s) como DNF.`)
        } else {
          toast.info('Time cap atingido! Sessão encerrada automaticamente.')
        }
      })
      .catch(() => toast.error('Erro ao encerrar sessão por time cap.'))
  }, [isTimeCapped]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Ajuste Manual — {adjustTarget?.display_name}</DialogTitle>
            <DialogDescription>Corrija o tempo ou o tipo de resultado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Tipo de Resultado</Label>
              <div className="flex gap-2">
                <Button variant={adjustType === 'finished' ? 'default' : 'outline'} className="flex-1" onClick={() => setAdjustType('finished')}>Finalizado</Button>
                <Button variant={adjustType === 'dnf' ? 'destructive' : 'outline'} className="flex-1" onClick={() => setAdjustType('dnf')}>DNF</Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustTime">Tempo (mm:ss)</Label>
              <Input id="adjustTime" value={adjustTime} onChange={e => setAdjustTime(e.target.value)} placeholder="Ex: 12:34" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustNotes">Observação (opcional)</Label>
              <Input id="adjustNotes" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder="Motivo da correção..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancelar</Button>
            <Button onClick={handleAdjustSave} disabled={isAdjusting}>{isAdjusting ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Coluna esquerda: controles + QR */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Controle do Treino</CardTitle>
            <CardDescription>Gerencie o status da turma.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center bg-muted p-6 rounded-lg gap-4">
              <p className="text-sm font-medium uppercase text-muted-foreground tracking-widest">
                {session.status}
              </p>

              {session.status === 'waiting' && (
                <Button
                  size="lg"
                  className="w-full h-16 text-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={handleStart}
                  disabled={isLoading || participants.length === 0}
                  title={participants.length === 0 ? "Aguarde ao menos 1 participante para iniciar" : ""}
                >
                  <PlayCircle className="mr-2 h-6 w-6" />
                  INICIAR TREINO
                </Button>
              )}

              {session.status === 'live' && (
                <div className="text-center w-full space-y-4">
                  {countdownMsg ? (
                    <div className="text-3xl font-bold text-orange-500 animate-pulse">{countdownMsg}</div>
                  ) : (
                    <div className={`text-5xl font-mono font-bold tracking-wider ${isTimeCapped ? 'text-red-500' : 'text-primary'}`}>
                      {isTimeCapped ? 'TIME CAP' : stopwatch}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleFinish}
                    disabled={isLoading}
                  >
                    <StopCircle className="mr-2 h-4 w-4" />
                    Encerrar Turma
                  </Button>
                </div>
              )}

              {session.status === 'finished' && (
                <div className="text-center space-y-3">
                  <p className="text-2xl font-bold text-green-600">✔ Sessão Encerrada</p>
                  <p className="text-sm text-muted-foreground">
                    {session.actual_end_at ? new Date(session.actual_end_at).toLocaleTimeString('pt-BR') : ''}
                  </p>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/session/${session.id}/results`} />}>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Ver Ranking
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acesso dos Atletas</CardTitle>
            <CardDescription>Peça para os alunos lerem o QR Code.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-6 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <QRCode value={joinUrl} size={150} />
            </div>
            <code className="bg-muted px-4 py-2 rounded-md font-mono text-sm font-bold tracking-wider break-all text-center">
              {joinUrl}
            </code>
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita: tabela de atletas */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Atletas na Sessão ({participants.length})</CardTitle>
            <CardDescription>Acompanhamento em tempo real.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Cat.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Tempo Oficial</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhum atleta entrou ainda.
                      </TableCell>
                    </TableRow>
                  ) : participants
                    // Sort: finished first (by elapsed_ms), then others
                    .slice()
                    .sort((a: any, b: any) => {
                      const ra = a.session_results?.[0]
                      const rb = b.session_results?.[0]
                      if (ra && rb) return ra.elapsed_ms - rb.elapsed_ms
                      if (ra) return -1
                      if (rb) return 1
                      return 0
                    })
                    .map((p: any) => {
                      const result = p.session_results?.[0]
                      const ms = result?.elapsed_ms
                      const timeStr = ms != null
                        ? `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')}`
                        : '-'
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.display_name}</TableCell>
                          <TableCell>
                            <span className={`uppercase text-xs font-bold px-2 py-1 rounded ${p.performance_category === 'rx' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                              {p.performance_category}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              p.status === 'finished' ? 'bg-green-100 text-green-700' :
                              p.status === 'dnf'      ? 'bg-red-100 text-red-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {p.status.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            <div className="flex items-center justify-end gap-2">
                              {result?.is_manual_override && (
                                <div title={`Ajustado manualmente: ${result.notes || 'Sem observação'}`}>
                                  <Info className="h-4 w-4 text-orange-400" />
                                </div>
                              )}
                              <span>
                                {result?.result_type === 'dnf' ? (
                                  <span className="text-red-500">DNF</span>
                                ) : timeStr}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-10">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ajustar resultado"
                              onClick={() => openAdjust(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

      {/* Modal de Ajuste Manual */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Ajuste Manual — {adjustTarget?.display_name}</DialogTitle>
            <DialogDescription>Corrija o tempo ou o tipo de resultado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Tipo de Resultado</Label>
              <div className="flex gap-2">
                <Button variant={adjustType === 'finished' ? 'default' : 'outline'} className="flex-1" onClick={() => setAdjustType('finished')}>Finalizado</Button>
                <Button variant={adjustType === 'dnf' ? 'destructive' : 'outline'} className="flex-1" onClick={() => setAdjustType('dnf')}>DNF</Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustTime">Tempo (mm:ss)</Label>
              <Input id="adjustTime" value={adjustTime} onChange={e => setAdjustTime(e.target.value)} placeholder="Ex: 12:34" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustNotes">Observação (opcional)</Label>
              <Input id="adjustNotes" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder="Motivo da correção..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancelar</Button>
            <Button onClick={handleAdjustSave} disabled={isAdjusting}>{isAdjusting ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
