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
  const [ready, setReady] = useState(false)

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
    if (!i.error) setReady(true)
    const ids = (m.data ?? []).map((r) => r.user_id as string)
    if (!ids.length) return setMembers([])
    const p = await supabase.from('profiles').select('id, email, name, color').in('id', ids)
    const byId = new Map((p.data as ProfileRow[] | null)?.map((x) => [x.id, toMember(x)]) ?? [])
    setMembers(ids.map((id) => byId.get(id)).filter(Boolean) as Member[])
  }, [cloudId])

  useEffect(() => {
    if (!supabase || !cloudId) return
    const db = supabase
    setReady(false)
    setCode(null)
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
    /** ya sabemos si hay código o no (para crearlo solo si falta) */
    ready,
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
    join: async (c: string): Promise<{ error: 'offline' | 'invalidCode' | 'joinFailed' } | { space: string }> => {
      if (!supabase) return { error: 'offline' }
      const { data, error } = await supabase.rpc('join_space', { c })
      if (error) return { error: error.message.includes('invalid_code') ? 'invalidCode' : 'joinFailed' }
      return { space: data as string }
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

export interface SharedSpace {
  id: string
  owner: string
  createdAt: string
  members: Member[]
  lists: number
}

/** Todas mis compartidas (una por persona o grupo), en tiempo real */
export function useSharedSpaces(userId: string | null) {
  const [spaces, setSpaces] = useState<SharedSpace[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    const db = supabase
    const s = await db.from('spaces').select('id, owner, created_at').eq('kind', 'shared').order('created_at')
    if (s.error) return console.error('[hecho] spaces', s.error)
    const ids = (s.data ?? []).map((r) => r.id as string)
    if (!ids.length) return setSpaces([]), setLoaded(true)
    const [m, n] = await Promise.all([
      db.from('space_members').select('space_id, user_id, joined_at').in('space_id', ids).order('joined_at'),
      db.from('nodes').select('space_id').eq('type', 'list').in('space_id', ids),
    ])
    const users = [...new Set((m.data ?? []).map((r) => r.user_id as string))]
    const p = users.length ? await db.from('profiles').select('id, email, name, color').in('id', users) : { data: [] }
    const byId = new Map((p.data as ProfileRow[] | null)?.map((x) => [x.id, toMember(x)]) ?? [])
    setSpaces(
      (s.data ?? []).map((r) => ({
        id: r.id as string,
        owner: r.owner as string,
        createdAt: r.created_at as string,
        members: (m.data ?? [])
          .filter((x) => x.space_id === r.id)
          .map((x) => byId.get(x.user_id as string))
          .filter(Boolean) as Member[],
        lists: (n.data ?? []).filter((x) => x.space_id === r.id).length,
      })),
    )
    setLoaded(true)
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return
    const db = supabase
    load()
    const ch = db
      .channel(`shared-spaces:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members' }, load)
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      db.removeChannel(ch)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, load])

  // la última que he creado yo: si sigo solo en ella, no se puede crear otra
  const mine = spaces.filter((s) => s.owner === userId)
  const last = mine[mine.length - 1]
  const canCreate = !last || last.members.length > 1

  return {
    spaces,
    loaded,
    canCreate,
    reload: load,
    /** sale de una compartida (si se queda vacía, se elimina) */
    leave: async (id: string): Promise<boolean> => {
      if (!supabase) return false
      const { error } = await supabase.rpc('leave_space', { s: id })
      if (error) return console.error('[hecho] leave', error), false
      await load()
      return true
    },
    /** crea una compartida nueva y devuelve su id (o null si no se puede) */
    create: async (): Promise<string | null> => {
      if (!supabase || !canCreate) return null
      const { data, error } = await supabase.rpc('create_shared_space')
      if (error) return console.error('[hecho] create space', error), null
      await load()
      return data as string
    },
  }
}
