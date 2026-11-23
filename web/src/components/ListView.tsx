import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Sparkle, HeartHandshake, ListPlus } from 'lucide-react'
import { pathOf, type Space, type SpaceId } from '../lib/store'
import { AutoHeight, Composer, Empty, InlineName, SectionToggle, TodoItem } from './ui'
import { Members, type Team } from './Members'
import { useSelection } from '../lib/selection'
import { useT } from '../lib/i18n'

export function ListView({
  space,
  spaceId,
  listId,
  onCreateList,
  team,
}: {
  space: Space
  spaceId: SpaceId
  listId: string | null
  onCreateList: () => void
  team: Team
}) {
  const [showDone, setShowDone] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const sel = useSelection()
  const t = useT()
  const list = space.nodes.find((n) => n.id === listId && n.type === 'list')
  const isShared = spaceId === 'shared'

  const todos = useMemo(() => space.todos.filter((t) => t.listId === listId), [space.todos, listId])
  const pending = useMemo(
    () => todos.filter((t) => !t.done).sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt),
    [todos],
  )
  const done = useMemo(() => todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)), [todos])

  if (!list) {
    return (
      <div className="list-view">
        <Empty
          icon={<ListPlus size={26} strokeWidth={1.8} />}
          title={t('noLists')}
          text={t('noListsText')}
        />
        <button className="btn" style={{ alignSelf: 'center' }} onClick={onCreateList}>
          {t('newList')}
        </button>
      </div>
    )
  }

  const crumbs = pathOf(space.nodes, list.parentId)

  const row = (t: (typeof todos)[number]) => (
    <TodoItem
      key={t.id}
      todo={t}
      author={isShared ? team.members.find((m) => m.id === t.author) : undefined}
      onToggle={() => space.toggleTodo(t.id)}
      onRename={(txt) => space.renameTodo(t.id, txt)}
      onRemove={() => space.removeTodos([t.id])}
      onPriority={(p) => space.setPriority(t.id, p)}
    />
  )

  return (
    <div className="list-view">
      <header className="header">
        <div style={{ minWidth: 0 }}>
          {crumbs.length > 0 && <p className="crumbs">{crumbs.map((c) => c.name).join('  ›  ')}</p>}
          <h1 className="title" onDoubleClick={() => setRenaming(true)}>
            <InlineName
              value={list.name}
              editing={renaming}
              onDone={(v) => (v && space.renameNode(list.id, v), setRenaming(false))}
            />
          </h1>
          <p className="subtitle">
            {pending.length === 0 ? t('nothingPending') : t(pending.length === 1 ? 'pendingOne' : 'pendingMany', { n: pending.length })}
          </p>
        </div>
        <div className="header-actions">
          {todos.length > 0 && (
            <button className="text-btn" onClick={() => sel.setMode(!sel.mode)}>
              {sel.mode ? t('done') : t('select')}
            </button>
          )}
          {isShared && <Members team={team} me={space.me} />}
        </div>
      </header>

      <section className="card glass">
        <Composer
          focusKey={list.id}
          onAdd={(text, p) => space.addTodo(list.id, text, p)}
          placeholder={isShared ? t('addShared') : t('newTask')}
        />
        <div className="scroll">
          <AutoHeight>
            {todos.length === 0 ? (
              <Empty
                icon={isShared ? <HeartHandshake size={26} strokeWidth={1.8} /> : <Sparkle size={26} strokeWidth={1.8} />}
                title={isShared ? t('emptySharedTitle') : t('emptyTitle')}
                text={
                  isShared
                    ? t('emptySharedText')
                    : t('emptyText')
                }
              />
            ) : (
              <>
                <AnimatePresence initial={false}>{pending.map(row)}</AnimatePresence>
                {done.length > 0 && (
                  <>
                    <SectionToggle
                      open={showDone}
                      onToggle={() => setShowDone((s) => !s)}
                      label={t('completed', { n: done.length })}
                      onClear={() => space.clearDone(list.id)}
                    />
                    <AnimatePresence initial={false}>{showDone && done.map(row)}</AnimatePresence>
                  </>
                )}
              </>
            )}
          </AutoHeight>
        </div>
      </section>
    </div>
  )
}
