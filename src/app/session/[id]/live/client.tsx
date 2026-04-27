'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export function LiveWODClient({ session }: { session: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [now, setNow] = useState(Date.now())
  const [isFinishing, setIsFinishing] = useState(false)
  const [hasFinished, setHasFinished] = useState(false)
  const [participantId, setParticipantId] = useState<string | null>(null)

  useEffect(() => {
    const pId = localStorage.getItem(`rc_session_${session.id}`)
    setParticipantId(pId)
  }, [session.id])

  // Tick every 100ms for smooth countdown / stopwatch
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [])

  // Listen for session status change (e.g. coach finishes the session early)
  useEffect(() => {
    const ch = supabase
      .channel(`athlete_live_${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'class_sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          if (payload.new.status === 'finished') {
            router.push(`/session/${session.id}/results`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [session.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const startAt = new Date(session.actual_start_at).getTime()
  const timeCapMs = session.daily_workouts.time_cap_seconds * 1000
  const diff = now - startAt

  // ── Time states ─────────────────────────────────────────────────────────────
  const isCountdown = diff < 0
  const isTimeCapped = !isCountdown && diff >= timeCapMs
  const secondsLeft = isCountdown ? Math.ceil(Math.abs(diff) / 1000) : 0

  const totalSeconds = isCountdown ? 0 : Math.floor(diff / 1000)
  const stopwatch = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`

  // Lock button for the configured time after countdown ends
  const lockSeconds = session.daily_workouts.finish_button_initial_lock_enabled
    ? (session.daily_workouts.finish_button_initial_lock_seconds ?? 0)
    : 0
  const isLocked = !isCountdown && diff < lockSeconds * 1000

  // Auto-register DNF when time cap hits (send once)
  useEffect(() => {
    if (!isTimeCapped || hasFinished || !participantId) return
    // Auto-submit as DNF on time cap
    fetch('/api/public/finish-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_session_id: session.id, session_participant_id: participantId })
    }).then(() => setHasFinished(true))
  }, [isTimeCapped]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinish = useCallback(async () => {
    if (!participantId) {
      toast.error('Atleta não identificado no dispositivo.')
      return
    }
    setIsFinishing(true)
    try {
      const res = await fetch('/api/public/finish-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_session_id: session.id, session_participant_id: participantId })
      })
      if (res.ok) {
        setHasFinished(true)
        toast.success('Tempo registrado oficialmente!')
        // Redirect to ranking after short celebration delay
        setTimeout(() => router.push(`/session/${session.id}/results`), 2000)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao registrar tempo')
        setIsFinishing(false)
      }
    } catch {
      toast.error('Ocorreu um erro de conexão.')
      setIsFinishing(false)
    }
  }, [participantId, session.id, router])

  // ── Screens ─────────────────────────────────────────────────────────────────
  if (hasFinished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        <div className="h-32 w-32 bg-green-500 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
          <CheckCircle className="h-16 w-16 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-center">Treino Concluído!</h2>
        <p className="text-center text-white/70">
          Aguarde o Coach exibir o ranking oficial da turma.
        </p>
      </div>
    )
  }

  if (isCountdown) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-2xl text-primary font-bold mb-4 uppercase tracking-widest">Preparar</p>
        <div className="text-9xl font-bold text-white tabular-nums tracking-tighter animate-pulse">
          {secondsLeft}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-8">
      {/* Stopwatch area */}
      <div className="flex flex-col items-center">
        <p className="text-sm uppercase tracking-widest text-white/50 mb-2">
          {isTimeCapped ? 'Time Cap Atingido' : 'Cronômetro'}
        </p>
        <div className={`text-8xl font-mono font-bold tracking-tighter transition-colors ${isTimeCapped ? 'text-red-500' : 'text-white'}`}>
          {isTimeCapped ? 'TIME' : stopwatch}
        </div>
        {isTimeCapped && (
          <div className="text-6xl font-mono font-bold text-red-500 mt-1">CAP</div>
        )}
        {!isTimeCapped && (
          <p className="text-sm mt-4 font-mono text-white/40">
            Limite:{' '}
            {Math.floor(session.daily_workouts.time_cap_seconds / 60).toString().padStart(2, '0')}:
            {(session.daily_workouts.time_cap_seconds % 60).toString().padStart(2, '0')}
          </p>
        )}
      </div>

      {/* Finish button */}
      <div className="w-full mt-auto">
        <Button
          onClick={handleFinish}
          disabled={isLocked || isTimeCapped || isFinishing}
          className={`w-full h-32 text-4xl font-black tracking-widest rounded-3xl transition-all shadow-xl active:scale-95 ${
            isLocked ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' :
            isTimeCapped ? 'bg-red-900 text-red-400 cursor-not-allowed' :
            'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
        >
          {isFinishing ? 'SALVANDO...' : isTimeCapped ? 'DNF' : isLocked ? 'AGUARDE...' : 'ACABEI'}
        </Button>
        {isLocked && (
          <p className="text-center text-white/40 text-sm mt-3">
            Botão liberado em {lockSeconds - Math.floor(diff / 1000)}s
          </p>
        )}
      </div>
    </div>
  )
}
