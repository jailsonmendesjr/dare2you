'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export function JoinClient({ session }: { session: any }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [performance, setPerformance] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    let deviceFingerprint = localStorage.getItem('rc_fingerprint')
    if (!deviceFingerprint) {
      deviceFingerprint = Math.random().toString(36).substring(2, 15)
      localStorage.setItem('rc_fingerprint', deviceFingerprint)
    }

    try {
      const res = await fetch('/api/public/join-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_session_id: session.id,
          display_name: displayName,
          gender_category: gender,
          performance_category: performance,
          device_fingerprint: deviceFingerprint
        })
      })

      if (res.ok) {
        const participant = await res.json()
        localStorage.setItem(`rc_session_${session.id}`, participant.id)
        router.push(`/session/${session.id}/waiting`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao entrar na sessão')
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  if (session.status !== 'waiting') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-destructive">Sessão Indisponível</CardTitle>
          <CardDescription className="text-center">
            Esta sessão já foi iniciada ou encerrada pelo Coach.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={handleJoin}>
        <CardHeader>
          <CardTitle>Entrar no Treino</CardTitle>
          <CardDescription>
            Preencha seus dados para entrar na sala.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Como você quer ser chamado?</Label>
            <Input id="name" required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ex: João, Maria" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gênero</Label>
            <Select value={gender} onValueChange={(val) => setGender(val || '')} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="performance">Categoria</Label>
            <Select value={performance} onValueChange={(val) => setPerformance(val || '')} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rx">RX (Oficial)</SelectItem>
                <SelectItem value="scaled">Scaled (Adaptado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full text-lg h-12" disabled={isLoading || !displayName || !gender || !performance}>
            {isLoading ? 'Entrando...' : 'Entrar na Sala'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
