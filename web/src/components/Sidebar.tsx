import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { ChevronRight, Folder, FolderPlus, ListPlus, Pencil, Trash2, Circle, CheckCircle2 } from 'lucide-react'
import { childrenOf, descendants, type Node, type Space } from '../lib/store'
import { useSelection } from '../lib/selection'
import { InlineName, Menu, ease, type MenuItem } from './ui'
import { useT } from '../lib/i18n'

export function Tree({
  space,
  selectedId,
  onSelect,
  selectOnCreate,
}: {
  space: Space
  selectedId: string | null
  onSelect: (id: string) => void
  selectOnCreate?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const sel = useSelection()
  const t = useT()
  const root = useDroppable({ id: 'root', data: { kind: 'root' } })

  const pendingIn = (id: string) => {
    const ids = new Set(descendants(space.nodes, id))
    return space.todos.filter((t) => !t.done && ids.has(t.listId)).length
  }

  const create = (type: Node['type'], parentId: string | null) => {
    const n = space.addNode(type, parentId, type === 'list' ? t('newList') : t('newGroup'))
    setEditingId(n.id)
    if (type === 'list' && selectOnCreate) onSelect(n.id)
  }

  const rename = (id: string, v: string | null) => {
    if (v) space.renameNode(id, v)
    setEditingId(null)
  }

  const renderNode = (n: Node, depth: number): React.ReactNode => {
    const isGroup = n.type === 'group'
    const kids = isGroup ? childrenOf(space.nodes, n.id) : []
    const items: MenuItem[] = isGroup
      ? [
          { label: t('newList'), icon: <ListPlus size={15} />, onSelect: () => create('list', n.id) },
          { label: t('newSubgroup'), icon: <FolderPlus size={15} />, onSelect: () => create('group', n.id) },
          { label: t('rename'), icon: <Pencil size={15} />, onSelect: () => setEditingId(n.id) },
          { label: t('deleteGroup'), icon: <Trash2 size={15} />, danger: true, onSelect: () => space.removeNodes([n.id]) },
        ]
      : [
          { label: t('rename'), icon: <Pencil size={15} />, onSelect: () => setEditingId(n.id) },
          { label: t('deleteList'), icon: <Trash2 size={15} />, danger: true, onSelect: () => space.removeNodes([n.id]) },
        ]

    return (
      <div key={n.id}>
        <Row
          node={n}
          depth={depth}
          count={pendingIn(n.id)}
          current={selectedId === n.id}
          editing={editingId === n.id}
          menuOpen={menuId === n.id}
          onClick={(e) => {
            if (sel.click('node', n.id, e)) return
            if (isGroup) space.toggleNode(n.id)
            else onSelect(n.id)
          }}
          onDoubleClick={() => !sel.mode && setEditingId(n.id)}
          onContextMenu={() => setMenuId(n.id)}
          onRename={(v) => rename(n.id, v)}
          menu={<Menu items={items} open={menuId === n.id} onOpenChange={(o) => setMenuId(o ? n.id : null)} />}
        />

        {isGroup && (
          <AnimatePresence initial={false}>
            {!n.collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease }}
                style={{ overflow: 'hidden' }}
              >
                {kids.map((c) => renderNode(c, depth + 1))}
                {kids.length === 0 && (
                  <button className="row ghost" style={{ paddingLeft: 10 + (depth + 1) * 18 }} onClick={() => create('list', n.id)}>
                    <span className="row-icon" />
                    {t('addList')}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    )
  }

  const rootActive = sel.dragging?.kind === 'node' && sel.drop?.id === 'root'

  return (
    <div className="tree" role="tree">
      {childrenOf(space.nodes, null).map((n) => renderNode(n, 0))}
      <div ref={root.setNodeRef} className={`tree-end ${rootActive ? 'drop-root' : ''}`}>
        <div className="tree-actions">
          <button onClick={() => create('list', null)}>
            <ListPlus size={15} strokeWidth={2} /> {t('list')}
          </button>
          <button onClick={() => create('group', null)}>
            <FolderPlus size={15} strokeWidth={2} /> {t('group')}
          </button>
          <button
            className={`select-toggle ${sel.mode ? 'on' : ''}`}
            onClick={() => sel.setMode(!sel.mode)}
            title={sel.mode ? t('endSelect') : t('selectHint')}
          >
            <CheckCircle2 size={15} strokeWidth={2} />
            <span className="lbl">{sel.mode ? t('done') : t('select')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({
  node: n,
  depth,
  count,
  current,
  editing,
  menuOpen,
  onClick,
  onDoubleClick,
  onContextMenu,
  onRename,
  menu,
}: {
  node: Node
  depth: number
  count: number
  current: boolean
  editing: boolean
  menuOpen: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: () => void
  onRename: (v: string | null) => void
  menu: React.ReactNode
}) {
  const sel = useSelection()
  const isGroup = n.type === 'group'
  const drag = useDraggable({ id: `node:${n.id}`, data: { kind: 'node', id: n.id }, disabled: editing })
  const drop = useDroppable({ id: `node:${n.id}`, data: { kind: 'node', node: n } })

  const picked = sel.isPicked('node', n.id)
  const ghost = sel.dragging?.kind === 'node' && sel.dragging.ids.includes(n.id)
  const dropPos = sel.drop?.id === `node:${n.id}` ? sel.drop.pos : null

  return (
    <div
      ref={(el) => (drag.setNodeRef(el), drop.setNodeRef(el))}
      {...drag.listeners}
      {...drag.attributes}
      tabIndex={-1}
      className={[
        'row',
        isGroup ? 'group' : 'list',
        current && 'selected',
        picked && 'picked',
        ghost && 'ghosted',
        menuOpen && 'menu-open',
        dropPos && `drop-${dropPos}`,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: 10 + depth * 18, ['--indent' as string]: `${10 + depth * 18}px` }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => (e.preventDefault(), onContextMenu())}
      role={isGroup ? 'treeitem' : 'button'}
      aria-expanded={isGroup ? !n.collapsed : undefined}
      aria-selected={picked}
    >
      <span className="row-icon">
        {isGroup ? (
          <ChevronRight size={13} strokeWidth={2.6} className="chev" />
        ) : (
          <Circle size={8} strokeWidth={0} fill="currentColor" />
        )}
      </span>
      {isGroup && <Folder size={15} strokeWidth={2} className="folder" />}
      <InlineName className="row-name" value={n.name} editing={editing} onDone={onRename} />
      {count > 0 && <span className="row-count">{count}</span>}
      {!sel.mode && menu}
    </div>
  )
}
