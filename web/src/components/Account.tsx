import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut } from 'lucide-react'
import { supabase, signOut } from '../lib/supabase'
import { useProfile } from '../lib/members'
import { Avatar, ease } from './ui'
import { useT } from '../lib/i18n'

/** Avatar con mi cuenta: nombre editable y cerrar sesión */
export function Account({ userId, align = 'down' }: { userId: string; align?: 'up' | 'down' }) {
  const { me, rename } = useProfile(userId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => setName(me?.name ?? ''), [me?.name])
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  if (!supabase || !me) return null

  const save = () => {
    const v = name.trim()
    if (v && v !== me.name) rename(v)
    else setName(me.name)
  }

  return (
    <div className="pop-wrap account" ref={ref}>
      <button className="account-btn" onClick={() => setOpen((o) => !o)} aria-label={t('myAccount')}>
        <Avatar m={me} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`popover solid account-pop ${align}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <div className="account-head">
              <Avatar m={me} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <input
                  className="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={save}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  aria-label={t('yourName')}
                />
                <p className="account-mail">{me.email}</p>
              </div>
            </div>
            <button className="account-out" onClick={signOut}>
              <LogOut size={15} strokeWidth={2} />
              {t('signOut')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
