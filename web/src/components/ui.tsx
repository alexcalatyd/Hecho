import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, ArrowUp, X, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { Member, Priority, Todo, TodoStatus } from '../lib/store'
import { useSelection } from '../lib/selection'
import { useT } from '../lib/i18n'

export const ease = [0.32, 0.72, 0, 1] as const
export const spring = { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 } as const
/** Fundido limpio, sin desplazamientos: lo usamos para cambiar de panel */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22, ease } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'linear' } },
} as const

/* ---------- Segmented con indicador deslizante ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon: React.ReactNode; badge?: number }[]
}) {
  return (
    <div className="segmented glass" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId="seg-pill" className="pill" transition={spring} />}
          {o.icon}
          {o.label}
          {!!o.badge && <span className="badge">{o.badge}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------- Altura animada: el contenedor se adapta suave al contenido ---------- */
export function AutoHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | 'auto'>('auto')
  useLayoutEffect(() => {
    const el = inner.current!
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <motion.div animate={{ height: h }} transition={{ duration: 0.32, ease }} style={{ overflow: 'hidden' }}>
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}

export function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const t = useT()
  return (
    <button role="checkbox" aria-checked={checked} className="check" onClick={onChange} aria-label={t('complete')}>
      <motion.span
        initial={false}
        animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
        transition={spring}
        style={{ display: 'grid' }}
      >
        <Check size={13} strokeWidth={3.2} />
      </motion.span>
    </button>
  )
}

export function Avatar({ m, size }: { m: Member; size?: 'sm' }) {
  return (
    <span className={`avatar ${size ?? ''}`} style={{ background: m.color }} title={m.name}>
      {m.name[0]}
    </span>
  )
}

/* ---------- Prioridad: tres barritas ---------- */
const PRIORITY_KEY = { 1: 'p1', 2: 'p2', 3: 'p3' } as const
const nextPriority = (p: Priority) => ((p % 3) + 1) as Priority

export function PriorityButton({
  value,
  onChange,
  quiet,
}: {
  value: Priority
  onChange: (p: Priority) => void
  quiet?: boolean
}) {
  const t = useT()
  return (
    <button
      type="button"
      className={`prio p${value} ${quiet ? 'quiet' : ''}`}
      onClick={() => onChange(nextPriority(value))}
      title={`${t(PRIORITY_KEY[value])} · ${t('clickToChange')}`}
      aria-label={t(PRIORITY_KEY[value])}
    >
      {[1, 2, 3].map((i) => (
        <motion.i
          key={i}
          initial={false}
          animate={{ opacity: value >= i ? 1 : 0.28, scaleY: value >= i ? 1 : 0.8 }}
          transition={spring}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </button>
  )
}

/* ---------- Estado: sin empezar / en progreso ---------- */
export function StatusButton({ value, onChange }: { value: TodoStatus; onChange: (s: TodoStatus) => void }) {
  const t = useT()
  const doing = value === 'doing'
  const label = t(doing ? 'statusDoing' : 'statusTodo')
  return (
    <button
      type="button"
      className={`status ${doing ? 'doing' : 'todo'}`}
      onClick={() => onChange(doing ? 'todo' : 'doing')}
      title={`${label} · ${t('clickToChange')}`}
      aria-label={label}
      aria-pressed={doing}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={doing ? undefined : '2.2 1.6'} />
        <motion.path
          d="M6 2.5 A3.5 3.5 0 0 1 6 9.5 Z"
          fill="currentColor"
          initial={false}
          animate={{ opacity: doing ? 1 : 0, scale: doing ? 1 : 0.5 }}
          style={{ originX: '6px', originY: '6px' }}
          transition={spring}
        />
      </svg>
      <span>{label}</span>
    </button>
  )
}

/* ---------- Campo para añadir ---------- */
export function Composer({
  onAdd,
  placeholder,
  focusKey,
}: {
  onAdd: (t: string, p: Priority) => void
  placeholder: string
  focusKey?: string
}) {
  const t = useT()
  const [v, setV] = useState('')
  const [p, setP] = useState<Priority>(1)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey && e.key === 'n') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setV(''), [focusKey])

  const submit = () => {
    // "!! texto" también fija la prioridad
    const m = v.trim().match(/^(!{1,3})\s+(.+)$/)
    const text = m ? m[2] : v.trim()
    if (!text) return
    onAdd(text, m ? (m[1].length as Priority) : p)
    setV('')
    setP(1)
  }

  const active = !!v.trim() || p > 1

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Plus className="plus" size={20} strokeWidth={2} />
      <input
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (setV(''), setP(1), ref.current?.blur())
          if (e.metaKey && e.key === 'ArrowUp') (e.preventDefault(), setP((x) => Math.min(3, x + 1) as Priority))
          if (e.metaKey && e.key === 'ArrowDown') (e.preventDefault(), setP((x) => Math.max(1, x - 1) as Priority))
        }}
        placeholder={placeholder}
        enterKeyHint="done"
        autoComplete="off"
      />
      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            key="prio"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={spring}
          >
            <PriorityButton value={p} onChange={setP} />
          </motion.div>
        )}
      </AnimatePresence>
      <button type="submit" className="send" disabled={!v.trim()} aria-label={t('add')}>
        <ArrowUp size={17} strokeWidth={2.6} />
      </button>
    </form>
  )
}

/* ---------- Tarea ---------- */
export function TodoItem({
  todo,
  author,
  onToggle,
  onRename,
  onRemove,
  onPriority,
  onStatus,
}: {
  todo: Todo
  author?: Member
  onToggle: () => void
  onRename: (t: string) => void
  onRemove: () => void
  onPriority: (p: Priority) => void
  onStatus: (s: TodoStatus) => void
}) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)
  const sel = useSelection()
  const drag = useDraggable({ id: `todo:${todo.id}`, data: { kind: 'todo', id: todo.id }, disabled: editing })
  const picked = sel.isPicked('todo', todo.id)
  const ghost = sel.dragging?.kind === 'todo' && sel.dragging.ids.includes(todo.id)

  const finish = () => {
    const t = draft.trim()
    if (t && t !== todo.text) onRename(t)
    else setDraft(todo.text)
    setEditing(false)
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease }}
      className={['item-wrap', todo.done && 'done', picked && 'picked', ghost && 'ghosted', sel.mode && 'selecting']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="item"
        ref={drag.setNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        tabIndex={-1}
        role="listitem"
        aria-selected={picked}
        onClickCapture={(e) => {
          if (editing) return
          if (sel.click('todo', todo.id, e)) (e.stopPropagation(), e.preventDefault())
        }}
      >
        <Checkbox checked={todo.done} onChange={onToggle} />
        {editing ? (
          <input
            className="edit"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finish}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finish()
              if (e.key === 'Escape') (setDraft(todo.text), setEditing(false))
            }}
          />
        ) : (
          <span className="text" onDoubleClick={() => !todo.done && setEditing(true)}>
            {todo.text}
          </span>
        )}
        <span className="meta">
          {!todo.done && <StatusButton value={todo.status ?? 'todo'} onChange={onStatus} />}
          {!todo.done && <PriorityButton value={todo.priority} onChange={onPriority} quiet />}
          {author && <Avatar m={author} size="sm" />}
          <button className="del" onClick={onRemove} aria-label={t('delete')}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </span>
      </div>
    </motion.div>
  )
}

export function SectionToggle({
  open,
  onToggle,
  label,
  onClear,
}: {
  open: boolean
  onToggle: () => void
  label: string
  onClear: () => void
}) {
  const t = useT()
  return (
    <div className="section-toggle">
      <button onClick={onToggle} aria-expanded={open}>
        <ChevronRight size={14} strokeWidth={2.4} />
        {label}
      </button>
      <button className="clear" onClick={onClear}>
        {t('clear')}
      </button>
    </div>
  )
}

export function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="empty">
      <span className="icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

/* ---------- Menú contextual ligero ---------- */
export interface MenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onSelect: () => void
}

export function Menu({ items, open, onOpenChange }: { items: MenuItem[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)

  // se coloca en una capa flotante sobre toda la ventana para que nada lo recorte
  useLayoutEffect(() => {
    if (!open || !btn.current) return setPos(null)
    const r = btn.current.getBoundingClientRect()
    const w = 190
    const h = items.length * 30 + 10
    const up = r.bottom + 4 + h > window.innerHeight - 8
    setPos({
      top: up ? r.top - h - 4 : r.bottom + 4,
      left: Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8),
      up,
    })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) =>
      !btn.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node) && onOpenChange(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false)
    const dismiss = () => onOpenChange(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open, onOpenChange])

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div className="menu-wrap">
      <button
        ref={btn}
        className="icon-btn more"
        aria-label={t('moreOptions')}
        onClick={(e) => (e.stopPropagation(), onOpenChange(!open))}
        data-open={open}
      >
        <MoreHorizontal size={16} strokeWidth={2.2} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={pop}
              className="menu solid"
              role="menu"
              style={{ top: pos.top, left: pos.left, transformOrigin: pos.up ? 'bottom right' : 'top right' }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.16, ease } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              // los eventos de un portal suben por el árbol de React: que no lleguen a la fila
              onClick={stop}
              onDoubleClick={stop}
              onMouseDown={stop}
              onPointerDown={stop}
              onTouchStart={stop}
              onContextMenu={(e) => (e.preventDefault(), e.stopPropagation())}
            >
              {items.map((it) => (
                <button
                  key={it.label}
                  role="menuitem"
                  className={it.danger ? 'danger' : ''}
                  onClick={() => (onOpenChange(false), it.onSelect())}
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/* ---------- Nombre editable en línea ---------- */
export function InlineName({
  value,
  editing,
  onDone,
  className,
}: {
  value: string
  editing: boolean
  onDone: (v: string | null) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value, editing])
  if (!editing) return <span className={className}>{value}</span>
  const finish = () => onDone(draft.trim() || null)
  return (
    <input
      className={`inline-name ${className ?? ''}`}
      autoFocus
      onFocus={(e) => e.target.select()}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish()
        if (e.key === 'Escape') onDone(null)
      }}
    />
  )
}
