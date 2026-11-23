import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Settings as Gear } from 'lucide-react'
import { setLang, useLang, useT, type Lang } from '../lib/i18n'
import { ease } from './ui'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

/** Selector de idioma compacto (dos opciones con indicador deslizante) */
export function LangSwitch() {
  const lang = useLang()
  return (
    <div className="lang-switch" role="radiogroup">
      {LANGS.map((l) => (
        <button key={l.value} role="radio" aria-checked={lang === l.value} onClick={() => setLang(l.value)}>
          {lang === l.value && (
            <motion.span layoutId="lang-pill" className="lang-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
          )}
          {l.label}
        </button>
      ))}
    </div>
  )
}

/** Botón de ajustes pequeñito */
export function Settings({ align = 'up' }: { align?: 'up' | 'down' }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div className="pop-wrap" ref={ref}>
      <button className="icon-btn settings-btn" data-open={open} onClick={() => setOpen((o) => !o)} aria-label={t('settings')} title={t('settings')}>
        <Gear size={15} strokeWidth={2} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`popover solid settings-pop ${align}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <p className="settings-label">{t('language')}</p>
            <LangSwitch />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
