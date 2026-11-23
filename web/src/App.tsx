import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { User, Users, ChevronLeft } from 'lucide-react'
import { useSpace, childrenOf, type SpaceId, type Space } from './lib/store'
import { useMembers, useSharedSpaces } from './lib/members'
import { Account } from './components/Account'
import { Settings } from './components/Settings'
import { Segmented, fade } from './components/ui'
import { Tree } from './components/Sidebar'
import { ListView } from './components/ListView'
import { SelectionProvider } from './components/Selection'
import { ShareButton } from './components/Members'
import { useT } from './lib/i18n'

function useWide() {
  const q = '(min-width: 760px)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const f = () => setWide(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return wide
}

function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {}
  }, [key, v])
  return [v, setV] as const
}

/** primera lista del árbol, recorriendo en orden */
function firstList(s: Space, parent: string | null = null): string | null {
  for (const n of childrenOf(s.nodes, parent)) {
    if (n.type === 'list') return n.id
    const inner = firstList(s, n.id)
    if (inner) return inner
  }
  return null
}

export interface Cloud {
  personal: string
  shared: string
}

export default function App({ userId, cloud }: { userId: string; cloud: Cloud | null }) {
  const wide = useWide()
  const t = useT()
  const [spaceId, setSpaceId] = usePersisted<SpaceId>('hecho:space', 'personal')
  const [selected, setSelected] = usePersisted<Record<string, string | null>>('hecho:selected', {
    personal: null,
    shared: null,
  })
  const [screen, setScreen] = useState<'home' | 'list'>('home')

  // compartida activa: puede haber varias (una con cada persona)
  const [sharedPick, setSharedPick] = usePersisted<string | null>(`hecho:sharedSpace:${userId}`, null)
  const shared = useSharedSpaces(cloud ? userId : null)
  const valid = (id: string | null) => !!id && (!shared.loaded || shared.spaces.some((s) => s.id === id))
  const sharedId = !cloud
    ? null
    : valid(sharedPick)
      ? sharedPick
      : valid(cloud.shared)
        ? cloud.shared
        : ([...shared.spaces].sort((a, b) => b.members.length - a.members.length)[0]?.id ?? cloud.shared)

  const spaces = {
    personal: useSpace('personal', cloud?.personal ?? null, userId),
    shared: useSpace('shared', sharedId, userId),
  }
  const team = useMembers(sharedId)
  const sharedNav = { ...shared, current: sharedId, pick: setSharedPick }
  const space = spaces[spaceId]
  const selKey = spaceId === 'shared' && sharedId ? `shared:${sharedId}` : spaceId

  // si la lista seleccionada ya no existe, cae a la primera disponible
  const sel = space.nodes.some((n) => n.id === selected[selKey] && n.type === 'list')
    ? selected[selKey]
    : firstList(space)

  const select = (id: string) => {
    setSelected((s) => ({ ...s, [selKey]: id }))
    setScreen('list')
  }

  const pendingOf = (s: Space) => s.todos.filter((t) => !t.done).length

  // ⌘1 / ⌘2 cambia de espacio
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      if (e.key === '1') (e.preventDefault(), setSpaceId('personal'))
      if (e.key === '2') (e.preventDefault(), setSpaceId('shared'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSpaceId])

  const segmented = (
    <Segmented
      value={spaceId}
      onChange={setSpaceId}
      options={[
        { value: 'personal', label: t('personal'), icon: <User size={14} strokeWidth={2.2} />, badge: pendingOf(spaces.personal) },
        { value: 'shared', label: t('shared'), icon: <Users size={14} strokeWidth={2.2} />, badge: pendingOf(spaces.shared) },
      ]}
    />
  )

  const tree = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={selKey} {...fade}>
        <Tree space={space} selectedId={wide ? sel : null} onSelect={select} selectOnCreate={wide} />
      </motion.div>
    </AnimatePresence>
  )

  const list = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={`${selKey}:${sel}`} {...fade} className="fill">
        <ListView
          space={space}
          spaceId={spaceId}
          listId={sel}
          team={team}
          shared={sharedNav}
          sharePopover={!!cloud}
          onCreateList={() => select(space.addNode('list', null, t('newList')).id)}
        />
      </motion.div>
    </AnimatePresence>
  )

  return (
    <SelectionProvider space={space} currentListId={sel} resetKey={selKey}>

      {wide ? (
        <div className="shell">
          <aside className="sidebar glass">
            <div className="sidebar-top">{segmented}</div>
            <div className="sidebar-scroll">{tree}</div>
            <div className="sidebar-foot">
              {cloud && <Account userId={userId} align="up" />}
              <Settings align="up" />
            </div>
          </aside>
          <main className="main">{list}</main>
        </div>
      ) : (
        <div className="mobile">
          <AnimatePresence mode="wait" initial={false}>
            {screen === 'home' || !sel ? (
              <motion.div key="home" {...fade} className="fill">
                <div className="topbar">
                  <div className="topbar-settings">
                    <Settings align="down" />
                  </div>
                  {segmented}
                  {cloud && (
                    <div className="topbar-account">
                      <Account userId={userId} align="down" />
                    </div>
                  )}
                </div>
                <div className="home-head">
                  <h1 className="title home-title">{t(spaceId)}</h1>
                  {spaceId === 'shared' && cloud && <ShareButton team={team} me={space.me} shared={sharedNav} />}
                </div>
                <div className="card glass tree-card">{tree}</div>
              </motion.div>
            ) : (
              <motion.div key="list" {...fade} className="fill">
                <button className="back" onClick={() => setScreen('home')}>
                  <ChevronLeft size={20} strokeWidth={2.4} />
                  {t(spaceId)}
                </button>
                {list}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </SelectionProvider>
  )
}
