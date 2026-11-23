import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { tr } from './i18n'

export type SpaceId = 'personal' | 'shared'
export type Priority = 0 | 1 | 2 | 3 // ninguna, baja, media, alta

/** Un nodo del árbol: grupo (carpeta, se puede anidar) o lista (contiene tareas). */
export interface Node {
  id: string
  type: 'group' | 'list'
  name: string
  parentId: string | null
  createdAt: number
  order?: number
  /** estado de la interfaz, solo local (no se sincroniza) */
  collapsed?: boolean
}

/** Estado de una tarea pendiente; las completadas no tienen estado */
export type TodoStatus = 'todo' | 'doing'

export interface Todo {
  id: string
  listId: string
  text: string
  done: boolean
  priority: Priority
  /** sin empezar o en progreso (datos antiguos pueden no tenerlo) */
  status?: TodoStatus
  createdAt: number
  doneAt?: number
  author: string
}

export interface Member {
  id: string
  name: string
  color: string
  email?: string
}

interface SpaceData {
  nodes: Node[]
  todos: Todo[]
}

export const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)

/* ------------------------------------------------------------------ utilidades de árbol */

/** ids de un nodo y todos sus descendientes */
export function descendants(nodes: Node[], id: string): string[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) nodes.filter((n) => n.parentId === out[i]).forEach((n) => out.push(n.id))
  return out
}

export function pathOf(nodes: Node[], id: string | null): Node[] {
  const path: Node[] = []
  let cur = nodes.find((n) => n.id === id)
  while (cur) {
    path.unshift(cur)
    cur = nodes.find((n) => n.id === cur!.parentId)
  }
  return path
}

export const orderOf = (n: Node) => n.order ?? n.createdAt

export function childrenOf(nodes: Node[], parentId: string | null) {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => orderOf(a) - orderOf(b))
}

/** Quita de una selección los nodos cuyo ancestro también está seleccionado */
export function topLevel(nodes: Node[], ids: string[]) {
  const set = new Set(ids)
  return ids.filter((id) => !pathOf(nodes, nodes.find((n) => n.id === id)?.parentId ?? null).some((a) => set.has(a.id)))
}

export type DropPos = 'before' | 'after' | 'inside'

/* ------------------------------------------------------------------ almacenamiento local */

const read = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {}
}

const LOCAL_KEY = (s: SpaceId) => `hecho:v2:${s}`
const CACHE_KEY = (cloudId: string) => `hecho:cloud:${cloudId}`
const COLLAPSED_KEY = 'hecho:collapsed'

function seedList(space: SpaceId): Node {
  return { id: uid(), type: 'list', name: tr(space === 'personal' ? 'defaultPersonalList' : 'defaultSharedList'), parentId: null, createdAt: Date.now(), order: 0 }
}

function loadLocal(space: SpaceId): SpaceData {
  const d = read<SpaceData | null>(LOCAL_KEY(space), null)
  if (d) return d
  const s = { nodes: [seedList(space)], todos: [] }
  write(LOCAL_KEY(space), s)
  return s
}

/* ------------------------------------------------------------------ filas de la base de datos */

type NodeRow = { id: string; space_id: string; type: string; name: string; parent_id: string | null; order: number | null; created_at: number }
type TodoRow = {
  id: string
  space_id: string
  list_id: string
  text: string
  done: boolean
  priority: number
  status: TodoStatus
  created_at: number
  done_at: number | null
  author: string | null
}

const nodeToRow = (n: Node, space_id: string): NodeRow => ({
  id: n.id,
  space_id,
  type: n.type,
  name: n.name,
  parent_id: n.parentId,
  order: n.order ?? null,
  created_at: n.createdAt,
})
const rowToNode = (r: NodeRow): Node => ({
  id: r.id,
  type: r.type as Node['type'],
  name: r.name,
  parentId: r.parent_id,
  order: r.order ?? undefined,
  createdAt: Number(r.created_at),
})
const todoToRow = (t: Todo, space_id: string): TodoRow => ({
  id: t.id,
  space_id,
  list_id: t.listId,
  text: t.text,
  done: t.done,
  priority: t.priority,
  status: t.done ? 'todo' : (t.status ?? 'todo'),
  created_at: t.createdAt,
  done_at: t.doneAt ?? null,
  author: t.author,
})
const rowToTodo = (r: TodoRow): Todo => ({
  id: r.id,
  listId: r.list_id,
  text: r.text,
  done: r.done,
  priority: r.priority as Priority,
  status: r.status === 'doing' && !r.done ? 'doing' : 'todo',
  createdAt: Number(r.created_at),
  doneAt: r.done_at == null ? undefined : Number(r.done_at),
  author: r.author ?? '',
})

/** Qué filas hay que subir y cuáles borrar para pasar de `a` a `b` */
function diff<T extends { id: string }, R>(a: T[], b: T[], toRow: (x: T) => R) {
  const before = new Map(a.map((x) => [x.id, JSON.stringify(toRow(x))]))
  const after = new Set(b.map((x) => x.id))
  const upserts = b.map(toRow).filter((r) => before.get((r as { id: string }).id) !== JSON.stringify(r))
  const deletes = a.filter((x) => !after.has(x.id)).map((x) => x.id)
  return { upserts, deletes }
}

/** Reasigna ids para subir datos locales antiguos (que pueden no ser uuid) */
function remap(d: SpaceData, me: string): SpaceData {
  const ids = new Map<string, string>()
  const id = (x: string) => (ids.has(x) ? ids.get(x)! : (ids.set(x, uid()), ids.get(x)!))
  return {
    nodes: d.nodes.map((n) => ({ ...n, id: id(n.id), parentId: n.parentId ? id(n.parentId) : null, collapsed: undefined })),
    todos: d.todos.filter((t) => ids.has(t.listId) || d.nodes.some((n) => n.id === t.listId)).map((t) => ({
      ...t,
      id: uid(),
      listId: id(t.listId),
      priority: (t.priority ?? 0) as Priority,
      author: me,
    })),
  }
}

/* ------------------------------------------------------------------ hook principal */

/**
 * Un espacio (personal o compartido).
 * - Sin Supabase: todo en localStorage.
 * - Con Supabase: caché local para arrancar al instante, escritura optimista y tiempo real.
 */
export function useSpace(space: SpaceId, cloudId: string | null, me: string) {
  const cloud = !!(supabase && cloudId)
  const [data, setData] = useState<SpaceData>(() =>
    cloud ? read(CACHE_KEY(cloudId!), { nodes: [], todos: [] }) : loadLocal(space),
  )
  const [collapsed, setCollapsed] = useState<string[]>(() => read(COLLAPSED_KEY, []))
  const [ready, setReady] = useState(!cloud)
  const ref = useRef(data)
  const queue = useRef(Promise.resolve())

  const apply = useCallback(
    (next: SpaceData) => {
      ref.current = next
      setData(next)
      write(cloud ? CACHE_KEY(cloudId!) : LOCAL_KEY(space), next)
    },
    [cloud, cloudId, space],
  )

  /** Envía a Supabase la diferencia entre dos estados, en orden */
  const push = useCallback(
    (prev: SpaceData, next: SpaceData) => {
      if (!cloud || !supabase) return
      const db = supabase
      const n = diff(prev.nodes, next.nodes, (x) => nodeToRow(x, cloudId!))
      const t = diff(prev.todos, next.todos, (x) => todoToRow(x, cloudId!))
      if (!n.upserts.length && !n.deletes.length && !t.upserts.length && !t.deletes.length) return
      queue.current = queue.current.then(async () => {
        const steps = [
          n.upserts.length && db.from('nodes').upsert(n.upserts),
          t.upserts.length && db.from('todos').upsert(t.upserts),
          t.deletes.length && db.from('todos').delete().in('id', t.deletes),
          n.deletes.length && db.from('nodes').delete().in('id', n.deletes),
        ]
        for (const s of steps) {
          if (!s) continue
          const { error } = await s
          if (error) console.error('[hecho] sync', error)
        }
      })
    },
    [cloud, cloudId],
  )

  const commit = useCallback(
    (fn: (d: SpaceData) => SpaceData) => {
      const prev = ref.current
      const next = fn(prev)
      if (next === prev) return
      apply(next)
      push(prev, next)
    },
    [apply, push],
  )

  /* --- carga inicial + tiempo real --- */
  useEffect(() => {
    if (!cloud || !supabase) return
    const db = supabase
    let alive = true

    const fetchAll = async () => {
      const [n, t] = await Promise.all([
        db.from('nodes').select('*').eq('space_id', cloudId!),
        db.from('todos').select('*').eq('space_id', cloudId!),
      ])
      if (!alive || n.error || t.error) return console.error('[hecho] fetch', n.error ?? t.error)
      let remote: SpaceData = { nodes: (n.data as NodeRow[]).map(rowToNode), todos: (t.data as TodoRow[]).map(rowToTodo) }

      // primera vez con cuenta: sube lo que hubiera en local; si no hay nada, crea la lista por defecto
      const flag = `hecho:migrated:${space}`
      if (!remote.nodes.length && !localStorage.getItem(flag)) {
        const local = read<SpaceData | null>(LOCAL_KEY(space), null)
        const seeded = local?.nodes.length ? remap(local, me) : space === 'personal' ? { nodes: [seedList(space)], todos: [] } : null
        localStorage.setItem(flag, '1')
        if (seeded) {
          apply(seeded)
          push({ nodes: [], todos: [] }, seeded)
          setReady(true)
          return
        }
      }
      apply(remote)
      setReady(true)
    }
    fetchAll()

    const onRow = (table: 'nodes' | 'todos') => (p: { eventType: string; new: unknown; old: unknown }) => {
      const cur = ref.current
      if (table === 'nodes') {
        const nodes =
          p.eventType === 'DELETE'
            ? cur.nodes.filter((x) => x.id !== (p.old as NodeRow).id)
            : [...cur.nodes.filter((x) => x.id !== (p.new as NodeRow).id), rowToNode(p.new as NodeRow)]
        apply({ ...cur, nodes })
      } else {
        const todos =
          p.eventType === 'DELETE'
            ? cur.todos.filter((x) => x.id !== (p.old as TodoRow).id)
            : [rowToTodo(p.new as TodoRow), ...cur.todos.filter((x) => x.id !== (p.new as TodoRow).id)]
        apply({ ...cur, todos })
      }
    }

    const filter = `space_id=eq.${cloudId}`
    const channel = db
      .channel(`space:${cloudId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes', filter }, onRow('nodes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter }, onRow('todos'))
      // al (re)conectar, recarga por si hubo cambios mientras estaba desconectado
      .subscribe((status) => status === 'SUBSCRIBED' && subscribedOnce++ > 0 && fetchAll())
    let subscribedOnce = 0

    // al volver a la app, por si se perdió algún evento
    const onVisible = () => document.visibilityState === 'visible' && fetchAll()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      db.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cloud, cloudId, space, me, apply, push])

  /* --- sincroniza entre pestañas en modo local --- */
  useEffect(() => {
    if (cloud) return
    const onStorage = (e: StorageEvent) => e.key === LOCAL_KEY(space) && apply(loadLocal(space))
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [cloud, space, apply])

  /* --- plegado de grupos (solo local) --- */
  const setFold = (id: string, fold: boolean) =>
    setCollapsed((c) => {
      const next = fold ? [...new Set([...c, id])] : c.filter((x) => x !== id)
      write(COLLAPSED_KEY, next)
      return next
    })
  const folded = new Set(collapsed)
  const nodes = data.nodes.map((n) => (folded.has(n.id) ? { ...n, collapsed: true } : n))

  const mapTodo = (id: string, f: (t: Todo) => Todo) =>
    commit((d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? f(t) : t)) }))

  return {
    nodes,
    todos: data.todos,
    ready,
    me,

    // --- árbol ---
    addNode: (type: Node['type'], parentId: string | null, name: string) => {
      const sib = childrenOf(ref.current.nodes, parentId)
      const n: Node = { id: uid(), type, name, parentId, createdAt: Date.now(), order: sib.length ? orderOf(sib[sib.length - 1]) + 1 : 0 }
      commit((d) => ({ ...d, nodes: [...d.nodes, n] }))
      if (parentId) setFold(parentId, false)
      return n
    },
    renameNode: (id: string, name: string) =>
      commit((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, name } : n)) })),
    toggleNode: (id: string) => setFold(id, !folded.has(id)),
    expandNode: (id: string) => setFold(id, false),
    removeNodes: (ids: string[]) =>
      commit((d) => {
        const all = new Set(ids.flatMap((id) => descendants(d.nodes, id)))
        return { nodes: d.nodes.filter((n) => !all.has(n.id)), todos: d.todos.filter((t) => !all.has(t.listId)) }
      }),
    /** Mueve nodos antes/después de un ancla o dentro de un grupo (ancla null = al final de la raíz) */
    moveNodes: (ids: string[], anchorId: string | null, pos: DropPos) => {
      const anchor = ref.current.nodes.find((n) => n.id === anchorId)
      const parentId = !anchor ? null : pos === 'inside' ? anchor.id : anchor.parentId
      commit((d) => {
        // nunca dentro de sí mismo ni de un descendiente
        const blocked = new Set(pathOf(d.nodes, parentId).map((n) => n.id))
        const moving = topLevel(d.nodes, ids)
          .filter((id) => !blocked.has(id))
          .map((id) => d.nodes.find((n) => n.id === id)!)
          .filter(Boolean)
          .sort((a, b) => orderOf(a) - orderOf(b))
        if (!moving.length) return d
        const movingIds = new Set(moving.map((n) => n.id))
        const siblings = childrenOf(d.nodes, parentId).filter((n) => !movingIds.has(n.id))
        let i = siblings.length
        if (anchor && pos !== 'inside') {
          const idx = siblings.findIndex((n) => n.id === anchor.id)
          if (idx >= 0) i = pos === 'before' ? idx : idx + 1
        }
        const ordered = [...siblings.slice(0, i), ...moving, ...siblings.slice(i)]
        const patch = new Map(ordered.map((n, k) => [n.id, { order: k, parentId }]))
        return { ...d, nodes: d.nodes.map((n) => (patch.has(n.id) ? { ...n, ...patch.get(n.id) } : n)) }
      })
      if (parentId) setFold(parentId, false)
    },

    // --- tareas ---
    addTodo: (listId: string, text: string, priority: Priority) =>
      commit((d) => ({
        ...d,
        todos: [{ id: uid(), listId, text, done: false, priority, createdAt: Date.now(), author: me }, ...d.todos],
      })),
    // al tacharla pierde el estado; si se destacha vuelve a «sin empezar»
    toggleTodo: (id: string) =>
      mapTodo(id, (t) => ({ ...t, done: !t.done, doneAt: t.done ? undefined : Date.now(), status: 'todo' })),
    setStatus: (id: string, status: TodoStatus) => mapTodo(id, (t) => (t.done ? t : { ...t, status })),
    renameTodo: (id: string, text: string) => mapTodo(id, (t) => ({ ...t, text })),
    setPriority: (id: string, priority: Priority) => mapTodo(id, (t) => ({ ...t, priority })),
    removeTodos: (ids: string[]) => {
      const set = new Set(ids)
      commit((d) => ({ ...d, todos: d.todos.filter((t) => !set.has(t.id)) }))
    },
    moveTodos: (ids: string[], listId: string) => {
      const set = new Set(ids)
      commit((d) => ({ ...d, todos: d.todos.map((t) => (set.has(t.id) ? { ...t, listId } : t)) }))
    },
    clearDone: (listId: string) =>
      commit((d) => ({ ...d, todos: d.todos.filter((t) => !(t.listId === listId && t.done)) })),
  }
}

export type Space = ReturnType<typeof useSpace>
