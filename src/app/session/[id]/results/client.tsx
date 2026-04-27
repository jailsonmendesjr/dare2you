'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MEDALS = ['🥇', '🥈', '🥉']

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
  const s = (totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function sortParticipants(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const ra = a.session_results?.[0]
    const rb = b.session_results?.[0]
    // Both finished → sort by elapsed_ms
    if (ra?.result_type === 'finished' && rb?.result_type === 'finished')
      return ra.elapsed_ms - rb.elapsed_ms
    // a finished, b didn't → a wins
    if (ra?.result_type === 'finished') return -1
    if (rb?.result_type === 'finished') return 1
    // Both dnf → sort by elapsed_ms (all same = time cap, but future-proof)
    if (ra && rb) return ra.elapsed_ms - rb.elapsed_ms
    if (ra) return -1
    if (rb) return 1
    return 0
  })
}

function RankingSection({
  title,
  participants,
  color,
}: {
  title: string
  participants: any[]
  color: string
}) {
  if (participants.length === 0) return null

  let currentRank = 1
  let lastTime: number | null = null

  return (
    <div className="mb-8">
      <div className={`flex items-center gap-3 mb-3 px-4`}>
        <span className={`text-xs font-black uppercase tracking-widest ${color} px-3 py-1 rounded-full bg-white/5 border border-current`}>
          {title}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="space-y-2 px-4">
        {participants.map((p, index) => {
          const result = p.session_results?.[0]
          const isDNF = result?.result_type === 'dnf'
          const hasResult = !!result
          
          let position: number | null = null
          if (hasResult && !isDNF) {
            const currentSec = Math.floor(result.elapsed_ms / 1000)
            if (lastTime === null) {
              lastTime = currentSec
            } else if (currentSec !== lastTime) {
              currentRank += 1
              lastTime = currentSec
            }
            position = currentRank
          }

          return (
            <div
              key={p.id}
              className={`flex items-center gap-4 rounded-2xl px-5 py-4 transition-all ${
                isDNF
                  ? 'bg-white/3 opacity-60'
                  : position === 1
                  ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/30'
                  : position === 2
                  ? 'bg-gradient-to-r from-gray-400/15 to-transparent border border-gray-400/20'
                  : position === 3
                  ? 'bg-gradient-to-r from-orange-700/15 to-transparent border border-orange-700/20'
                  : 'bg-white/5'
              }`}
            >
              {/* Position / Medal */}
              <div className="w-8 text-center shrink-0">
                {isDNF ? (
                  <span className="text-xs font-bold text-red-500">DNF</span>
                ) : position != null && position <= 3 ? (
                  <span className="text-2xl">{MEDALS[position - 1]}</span>
                ) : (
                  <span className="text-lg font-bold text-white/40">{position || '-'}</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={`font-bold truncate ${isDNF ? 'text-white/50' : 'text-white'}`}>
                  {p.display_name}
                </p>
                <p className="text-xs text-white/30 uppercase tracking-wider">
                  {p.gender_category === 'male' ? 'Masculino' : 'Feminino'}
                </p>
              </div>

              {/* Time */}
              <div className="shrink-0 text-right">
                {!hasResult ? (
                  <span className="text-white/30 font-mono text-lg">--:--</span>
                ) : isDNF ? (
                  <span className="text-red-400 font-mono text-lg font-bold">
                    {formatMs(result.elapsed_ms)}
                  </span>
                ) : (
                  <span className={`font-mono text-2xl font-black ${
                    position === 1 ? 'text-yellow-400' :
                    position === 2 ? 'text-gray-300' :
                    position === 3 ? 'text-orange-400' :
                    'text-white'
                  }`}>
                    {formatMs(result.elapsed_ms)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ResultsClient({
  sessionId,
  initialParticipants,
  isLive,
  timeCap,
}: {
  sessionId: string
  initialParticipants: any[]
  isLive: boolean
  timeCap: number
}) {
  const supabase = createClient()
  const [participants, setParticipants] = useState(() => 
    initialParticipants.map(p => ({
      ...p,
      session_results: Array.isArray(p.session_results) 
        ? p.session_results 
        : (p.session_results ? [p.session_results] : [])
    }))
  )
  const [filter, setFilter] = useState('male_rx')

  useEffect(() => {
    if (!isLive) return
    const ch = supabase
      .channel(`results_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_participants', filter: `class_session_id=eq.${sessionId}` },
        (payload) =>
          setParticipants((prev) =>
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
          )
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_results' },
        (payload) => {
          if (payload.new.class_session_id !== sessionId) return
          setParticipants((prev) =>
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
          if (payload.new.class_session_id !== sessionId) return
          setParticipants((prev) =>
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
  }, [sessionId, isLive]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredParticipants = sortParticipants(
    participants.filter(p => {
      if (filter === 'male_rx') return p.gender_category === 'male' && p.performance_category === 'rx'
      if (filter === 'female_rx') return p.gender_category === 'female' && p.performance_category === 'rx'
      if (filter === 'male_scaled') return p.gender_category === 'male' && p.performance_category === 'scaled'
      if (filter === 'female_scaled') return p.gender_category === 'female' && p.performance_category === 'scaled'
      return false
    })
  )

  const finishers = participants.filter((p) => p.session_results?.[0]?.result_type === 'finished').length
  const total = participants.length

  const filterLabels: Record<string, { title: string, color: string }> = {
    'male_rx': { title: 'Masculino • RX', color: 'text-blue-400' },
    'female_rx': { title: 'Feminino • RX', color: 'text-blue-400' },
    'male_scaled': { title: 'Masculino • Scaled', color: 'text-orange-400' },
    'female_scaled': { title: 'Feminino • Scaled', color: 'text-orange-400' },
  }

  return (
    <div className="flex-1 max-w-lg mx-auto w-full pb-12">
      {/* Stats bar */}
      <div className="flex justify-center gap-8 py-4 mb-4 border-y border-white/10 mx-4">
        <div className="text-center">
          <p className="text-2xl font-black text-primary">{finishers}</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Finalizaram</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-white">{total}</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-white/60">
            {Math.floor(timeCap / 60)}:{(timeCap % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Time Cap</p>
        </div>
      </div>

      <div className="px-4 mb-6">
        <Select value={filter} onValueChange={(v) => { if(v) setFilter(v) }}>
          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white font-bold h-12 rounded-xl">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
            <SelectItem value="male_rx">Masculino • RX</SelectItem>
            <SelectItem value="male_scaled">Masculino • Scaled</SelectItem>
            <SelectItem value="female_rx">Feminino • RX</SelectItem>
            <SelectItem value="female_scaled">Feminino • Scaled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {total === 0 ? (
        <div className="text-center py-20 text-white/30">Nenhum participante.</div>
      ) : (
        <RankingSection 
          title={filterLabels[filter].title} 
          participants={filteredParticipants} 
          color={filterLabels[filter].color} 
        />
      )}

      <p className="text-center text-xs text-white/20 mt-8">Round Count • Resultado Oficial</p>
    </div>
  )
}
