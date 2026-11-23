import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Member } from './store'

export interface InviteCode {
  code: string
  expiresAt: string
}

/** K7P2QX9M → K7P2-QX9M */
export const prettyCode = (c: string) => c.replace(/^(.{4})(.{4})$/, '$1-$2')

type ProfileRow = { id: string; email: string; name: string | null; color: string }
const toMember = (p: ProfileRow): Member => ({ id: p.id, name: p.name || p.email.split('@')[0], color: p.color, email: p.email })

export const LOCAL_ME: Member = { id: 'me', name: 'Tú', color: '#0A84FF' }

/** Miembros e invitaciones pendientes de un espacio, en tiempo real */
export function useMembers(cloudId: string | null) {
  const [members, setMembers] = useState<Member[]>(supabase ? [] : [LOCAL_ME])
  const [code, setCode] = useState<InviteCode | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !cloudId) return
    const [m, i] = await Promise.all([
      supabase.from('space_members').select('user_id, joined_at').eq('space_id', cloudId).order('joined_at'),
      supabase
        .from('invite_codes')
        .select('code, expires_at')
        .eq('space_id', cloudId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    ])
    setCode(i.data ? { code: i.data.code as string, expiresAt: i.data.expires_at as string } : null)
    const ids = (m.data ?? []).map((r) => r.user_id as string)
    if (!ids.length) return setMembers([])
    const p = await supabase.from('profiles').select('id, email, name, color').in('id', ids)
    const byId = new Map((p.data as ProfileRow[] | null)?.map((x) => [x.id, toMember(x)]) ?? [])
    setMembers(ids.map((id) => byId.get(id)).filter(Boolean) as Member[])
  }, [cloudId])

  useEffect(() => {
    if (!supabase || !cloudId) return
    const db = supabase
    load()
    const filter = `space_id=eq.${cloudId}`
    const ch = db
      .channel(`members:${cloudId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members', filter }, load)
      .subscribe()
    return () => {
      db.removeChannel(ch)
    }
  }, [cloudId, load])

  return {
    members,
    code,
    /** genera (o renueva) el código de invitación */
    createCode: async () => {
      if (!supabase || !cloudId) return
      const { data, error } = await supabase.rpc('create_invite', { s: cloudId })
      if (error) return console.error('[hecho] invite', error)
      setCode({ code: data as string, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() })
    },
    cancelCode: async () => {
      if (!supabase || !cloudId) return
      setCode(null)
      await supabase.from('invite_codes').delete().eq('space_id', cloudId)
    },
    /** entra en el espacio compartido de otra persona; devuelve un error o null */
    join: async (c: string): Promise<'offline' | 'invalidCode' | 'joinFailed' | null> => {
      if (!supabase) return 'offline'
      const { error } = await supabase.rpc('join_space', { c })
      if (error) return error.message.includes('invalid_code') ? 'invalidCode' : 'joinFailed'
      return null
    },
  }
}

/** Mi perfil (nombre editable) */
export function useProfile(userId: string | null) {
  const [me, setMe] = useState<Member | null>(supabase ? null : LOCAL_ME)
  useEffect(() => {
    if (!supabase || !userId) return
    supabase
      .from('profiles')
      .select('id, email, name, color')
      .eq('id', userId)
      .single()
      .then(({ data }) => data && setMe(toMember(data as ProfileRow)))
  }, [userId])
  return {
    me,
    rename: async (name: string) => {
      if (!supabase || !userId || !me) return
      setMe({ ...me, name })
      await supabase.from('profiles').update({ name }).eq('id', userId)
    },
  }
}
