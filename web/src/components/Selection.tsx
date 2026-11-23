import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { FolderInput, Trash2, X, Folder, Circle, Home } from 'lucide-react'
import { childrenOf, descendants, topLevel, type DropPos, type Node, type Space } from '../lib/store'
import { SelectionCtx, type Kind, type Selection } from '../lib/selection'
import { ease } from './ui'
import { useT } from '../lib/i18n'

/** Envuelve la app: selección múltiple, arrastrar y soltar, y la barra de acciones */
export function SelectionProvider({
  space,
  currentListId,
  resetKey,
  children,
}: {
  space: Space
  currentListId: string | null
  resetKey: string
  children: React.ReactNode
}) {
  const [kind, setKind] = useState<Kind | null>(null)
  const [ids, setIds] = useState<string[]>([])
  const [mode, setModeState] = useState(false)
  const [dragging, setDragging] = useState<Selection['dragging']>(null)
  const [drop, setDrop] = useState<Selection['drop']>(null)
  const t = useT()
  const expandTimer = useRef<{ id: string; t: number } | null>(null)

  const clear = useCallback(() => (setIds([]), setKind(null)), [])
  const setMode = useCallback((m: boolean) => (setModeState(m), !m && clear()), [clear])

  // al cambiar de espacio, se limpia todo
  useEffect(() => {
    setMode(false)
  }, [resetKey, setMode])

  // si algo seleccionado deja de existir, lo quitamos
  useEffect(() => {
    const exists = new Set(kind === 'node' ? space.nodes.map((n) => n.id) : space.todos.map((t) => t.id))
    setIds((prev) => (prev.every((id) => exists.has(id)) ? prev : prev.filter((id) => exists.has(id))))
  }, [space.nodes, space.todos, kind])

  const click: Selection['click'] = (k, id, e) => {
    const additive = e.metaKey || e.ctrlKey || e.shiftKey
    if (!mode && !additive) {
      if (ids.length) clear()
      return false
    }
    if (k !== kind) {
      setKind(k)
      setIds([id])
    } else {
      setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    }
    return true
  }

  const removeSelected = useCallback(() => {
    if (kind === 'node') space.removeNodes(ids)
    if (kind === 'todo') space.removeTodos(ids)
    clear()
  }, [kind, ids, space, clear])

  // teclado: Esc limpia, ⌘⌫ elimina, ⌘A selecciona todas las tareas de la lista
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (typing) return
      if (e.key === 'Escape' && (ids.length || mode)) setMode(false)
      if (e.metaKey && e.key === 'Backspace' && ids.length) (e.preventDefault(), removeSelected())
      if (e.metaKey && e.key === 'a' && currentListId) {
        e.preventDefault()
        setKind('todo')
        setIds(space.todos.filter((t) => t.listId === currentListId && !t.done).map((t) => t.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids, mode, setMode, removeSelected, currentListId, space.todos])

  /* ---------- arrastrar ---------- */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  )

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { kind: Kind; id: string }
    const group = kind === d.kind && ids.includes(d.id) ? ids : [d.id]
    setDragging({ kind: d.kind, ids: d.kind === 'node' ? topLevel(space.nodes, group) : group })
    navigator.vibrate?.(8)
  }

  const onDragMove = (e: DragMoveEvent) => {
    if (!dragging) return
    const over = e.over
    let next: Selection['drop'] = null
    if (over?.id === 'root') {
      if (dragging.kind === 'node') next = { id: 'root', pos: 'after' }
    } else if (over) {
      const n = (over.data.current as { node: Node }).node
      if (dragging.kind === 'todo') {
        if (n.type === 'list') next = { id: String(over.id), pos: 'inside' }
      } else {
        // no se puede soltar sobre sí mismo ni dentro de sus descendientes
        const blocked = new Set(dragging.ids.flatMap((id) => descendants(space.nodes, id)))
        if (!blocked.has(n.id)) {
          const a = e.activatorEvent as PointerEvent & TouchEvent
          const y0 = a.touches?.[0]?.clientY ?? a.clientY
          const rel = (y0 + e.delta.y - over.rect.top) / over.rect.height
          let pos: DropPos
          if (n.type === 'group') pos = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'inside'
          else pos = rel < 0.5 ? 'before' : 'after'
          next = { id: String(over.id), pos }
          // abre un grupo plegado si te quedas encima
          if (pos === 'inside' && n.collapsed) {
            if (expandTimer.current?.id !== n.id) {
              if (expandTimer.current) clearTimeout(expandTimer.current.t)
              expandTimer.current = { id: n.id, t: window.setTimeout(() => space.expandNode(n.id), 550) }
            }
          }
        }
      }
    }
    if (next?.id !== drop?.id || next?.pos !== drop?.pos) setDrop(next)
  }

  const onDragEnd = () => {
    if (expandTimer.current) clearTimeout(expandTimer.current.t)
    expandTimer.current = null
    if (dragging && drop) {
      if (dragging.kind === 'node') {
        const anchor = drop.id === 'root' ? null : drop.id.slice(5)
        space.moveNodes(dragging.ids, anchor, drop.pos)
      } else {
        space.moveTodos(dragging.ids, drop.id.slice(5))
      }
      clear()
    }
    setDragging(null)
    setDrop(null)
  }

  const ctx: Selection = {
    kind,
    ids,
    mode,
    setMode,
    click,
    isPicked: (k, id) => kind === k && ids.includes(id),
    clear,
    dragging,
    drop,
  }

  const overlayLabel = useMemo(() => {
    if (!dragging) return null
    if (dragging.ids.length > 1) return { icon: null, text: t('items', { n: dragging.ids.length }) }
    if (dragging.kind === 'todo') return { icon: null, text: space.todos.find((t) => t.id === dragging.ids[0])?.text }
    const n = space.nodes.find((x) => x.id === dragging.ids[0])
    return {
      icon: n?.type === 'group' ? <Folder size={14} strokeWidth={2} /> : <Circle size={7} strokeWidth={0} fill="currentColor" />,
      text: n?.name,
    }
  }, [dragging, space, t])

  return (
    <SelectionCtx.Provider value={ctx}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragEnd}
        autoScroll={{ threshold: { x: 0, y: 0.15 } }}
      >
        <div className={dragging ? 'is-dragging' : undefined} style={{ display: 'contents' }}>
          {children}
        </div>
        <DragOverlay dropAnimation={null}>
          {overlayLabel && (
            <div className="drag-chip">
              {overlayLabel.icon}
              <span>{overlayLabel.text}</span>
              {dragging && dragging.ids.length > 1 && <b>{dragging.ids.length}</b>}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <ActionBar space={space} kind={kind} ids={ids} mode={mode} onDone={() => setMode(false)} onRemove={removeSelected} currentListId={currentListId} />
    </SelectionCtx.Provider>
  )
}

/* ---------- Barra flotante con acciones sobre la selección ---------- */
function ActionBar({
  space,
  kind,
  ids,
  mode,
  onDone,
  onRemove,
  currentListId,
}: {
  space: Space
  kind: Kind | null
  ids: string[]
  mode: boolean
  onDone: () => void
  onRemove: () => void
  currentListId: string | null
}) {
  const [picker, setPicker] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const t = useT()
  const visible = ids.length > 0 || mode

  useEffect(() => {
    setPicker(false)
    setConfirm(false)
  }, [ids.length])

  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(false), 3000)
    return () => clearTimeout(t)
  }, [confirm])

  const n = ids.length
  const countLabel = t(kind === 'node' ? (n === 1 ? 'itemOne' : 'items') : n === 1 ? 'taskOne' : 'taskMany', { n })

  // destinos posibles, en orden de árbol
  const destinations = useMemo(() => {
    const out: { node: Node | null; depth: number; disabled?: boolean }[] = []
    const blocked = kind === 'node' ? new Set(ids.flatMap((id) => descendants(space.nodes, id))) : new Set<string>()
    const walk = (parent: string | null, depth: number) => {
      for (const node of childrenOf(space.nodes, parent)) {
        if (blocked.has(node.id)) continue
        if (kind === 'todo' || node.type === 'group')
          out.push({ node, depth, disabled: kind === 'todo' && node.type === 'group' })
        if (node.type === 'group') walk(node.id, depth + 1)
      }
    }
    if (kind === 'node') out.push({ node: null, depth: 0 })
    walk(null, kind === 'node' ? 1 : 0)
    return out
  }, [space.nodes, ids, kind])

  const moveTo = (target: Node | null) => {
    if (kind === 'node') space.moveNodes(ids, target?.id ?? null, target ? 'inside' : 'after')
    else if (target) space.moveTodos(ids, target.id)
    onDone()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="action-bar"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease } }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
        >
          <AnimatePresence>
            {picker && n > 0 && (
              <motion.div
                className="picker solid"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1, transition: { duration: 0.16, ease } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <p className="picker-title">{t('moveTo')}</p>
                <div className="picker-list">
                  {destinations.length === (kind === 'node' ? 1 : 0) && kind === 'todo' && (
                    <p className="picker-empty">{t('noOtherLists')}</p>
                  )}
                  {destinations.map(({ node, depth, disabled }) => (
                    <button
                      key={node?.id ?? 'root'}
                      disabled={disabled || (kind === 'todo' && node?.id === currentListId)}
                      style={{ paddingLeft: 10 + depth * 16 }}
                      onClick={() => moveTo(node)}
                    >
                      {!node ? (
                        <Home size={14} strokeWidth={2} />
                      ) : node.type === 'group' ? (
                        <Folder size={14} strokeWidth={2} />
                      ) : (
                        <Circle size={7} strokeWidth={0} fill="currentColor" />
                      )}
                      {node?.name ?? t('topLevel')}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bar solid">
            <span className="bar-count">{n === 0 ? t('tapToSelect') : countLabel}</span>
            {n > 0 && (
              <>
                <button className={picker ? 'on' : ''} onClick={() => (setPicker((p) => !p), setConfirm(false))}>
                  <FolderInput size={15} strokeWidth={2} />
                  {t('move')}
                </button>
                <button
                  className={`danger ${confirm ? 'confirm' : ''}`}
                  onClick={() => (confirm ? onRemove() : (setConfirm(true), setPicker(false)))}
                >
                  <Trash2 size={15} strokeWidth={2} />
                  {confirm ? t('confirmDelete', { n }) : t('delete')}
                </button>
              </>
            )}
            <button className="close" onClick={onDone} aria-label={t('cancelSelection')}>
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
