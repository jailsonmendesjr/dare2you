'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export function WaitingRoomClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel('athlete_waiting_room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'class_sessions', filter: `id=eq.${sessionId}` }, payload => {
        if (payload.new.status === 'live') {
          router.push(`/session/${sessionId}/live`)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, router, supabase])

  return null
}
