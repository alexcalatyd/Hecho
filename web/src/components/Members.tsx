import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Copy, Check, ChevronRight, UserPlus } from 'lucide-react'
import { prettyCode, type useMembers } from '../lib/members'
import { supabase } from '../lib/supabase'
import { Avatar, ease } from './ui'
import { useT } from '../lib/i18n'

export type Team = ReturnType<typeof useMembers>

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // WKWebView con esquema propio: sin API de portapapeles
    const t = document.createElement('textarea')
    t.value = text
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
}

/** Avatares de quien comparte el espacio (solo lectura, para la cabecera de la lista) */
export function Members({ team }: { team: Team }) {
  return (
    <div className="avatars">
      {team.members.map((m) => (
        <Avatar key={m.id} m={m} />
      ))}
    </div>
  )
}

/** Escritorio: avatares que abren el panel de compartir en un popover */
export function ShareButton({ team, me }: { team: Team; me: string }) {
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
      <button className="avatars share-trigger" data-open={open} onClick={() => setOpen((o) => !o)} aria-label={t('share')} title={t('share')}>
        {team.members.map((m) => (
          <Avatar key={m.id} m={m} />
        ))}
        {team.members.length <= 1 && (
          <span className="avatar add">
            <UserPlus size={13} strokeWidth={2.4} />
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="popover solid share-pop"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            style={{ transformOrigin: 'top right' }}
          >
            <SharePanel team={team} me={me} bare />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Panel de compartir: siempre visible en el espacio compartido, con el código listo para copiar */
export function SharePanel({ team, me, bare }: { team: Team; me: string; bare?: boolean }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asked = useRef(false)

  // si el espacio aún no tiene código, lo creamos al entrar: nada de pasos previos
  useEffect(() => {
    if (!supabase || !team.ready || team.code || asked.current) return
    asked.current = true
    team.createCode()
  }, [team.ready, team.code, team])

  if (!supabase) return null

  const join = async () => {
    setBusy(true)
    const err = await team.join(joinCode)
    setBusy(false)
    if (err) return setError(t(err))
    // vuelve a arrancar para cargar el espacio al que te has unido
    Object.keys(localStorage)
      .filter((k) => k.startsWith('hecho:boot:'))
      .forEach((k) => localStorage.removeItem(k))
    location.reload()
  }

  const days = team.code ? Math.max(1, Math.ceil((Date.parse(team.code.expiresAt) - Date.now()) / 864e5)) : 0
  const alone = team.members.length <= 1
  const others = team.members.filter((m) => m.id !== me)

  return (
    <section className={`share-panel ${bare ? 'bare' : 'glass'}`}>
      <div className="share-head">
        <div>
          <h4>{alone ? t('inviteSomeone') : t('sharedWith', { names: others.map((m) => m.name).join(', ') })}</h4>
          <p>{t('shareText')}</p>
        </div>
        {!alone && !bare && <Members team={team} />}
      </div>

      <div className="code-box">
        <span>{team.code ? prettyCode(team.code.code) : '····-····'}</span>
        <button
          className="icon-btn"
          disabled={!team.code}
          onClick={() =>
            copy(prettyCode(team.code!.code)).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
          }
          aria-label={t('copyCode')}
        >
          {copied ? <Check size={16} strokeWidth={2.4} /> : <Copy size={16} strokeWidth={2} />}
        </button>
      </div>
      {team.code && (
        <div className="code-meta">
          <span>{t(days === 1 ? 'codeMetaOne' : 'codeMetaMany', { n: days })}</span>
          <button onClick={team.createCode}>{t('newCode')}</button>
        </div>
      )}

      {alone && (
        <div className="join">
          <button className="join-toggle" aria-expanded={joining} onClick={() => (setJoining((j) => !j), setError(null))}>
            <ChevronRight size={14} strokeWidth={2.4} />
            {t('invited')}
          </button>
          <AnimatePresence initial={false}>
            {joining && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, transition: { duration: 0.24, ease } }}
                exit={{ height: 0, opacity: 0, transition: { duration: 0.16, ease } }}
                style={{ overflow: 'hidden' }}
                onSubmit={(e) => (e.preventDefault(), join())}
              >
                <div className="row-form">
                  <input
                    placeholder="XXXX-XXXX"
                    value={joinCode}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={12}
                    onChange={(e) => (setJoinCode(e.target.value.toUpperCase().trim()), setError(null))}
                  />
                  <button className="btn" disabled={joinCode.replace(/[^A-Z0-9]/gi, '').length < 8 || busy}>
                    {t('join')}
                  </button>
                </div>
                <p className="join-hint">{t('joinHint')}</p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
      {error && <p className="pop-msg err">{error}</p>}
    </section>
  )
}
