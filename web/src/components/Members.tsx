import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { UserPlus, Copy, Check } from 'lucide-react'
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

export function Members({ team, me }: { team: Team; me: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

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

  return (
    <div className="pop-wrap" ref={ref}>
      <div className="avatars">
        {team.members.map((m) => (
          <Avatar key={m.id} m={m} />
        ))}
        <button className="avatar add" onClick={() => (setOpen((o) => !o), setError(null))} aria-label={t('share')}>
          <UserPlus size={13} strokeWidth={2.4} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="popover solid share-pop"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            style={{ transformOrigin: 'top right' }}
          >
            <h4>{t('share')}</h4>
            {!supabase ? (
              <p>{t('shareSignIn')}</p>
            ) : (
              <>
                <p>{t('shareText')}</p>
                {team.code ? (
                  <>
                    <div className="code-box">
                      <span>{prettyCode(team.code.code)}</span>
                      <button
                        className="icon-btn"
                        onClick={() =>
                          copy(prettyCode(team.code!.code)).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
                        }
                        aria-label={t('copyCode')}
                      >
                        {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
                      </button>
                    </div>
                    <div className="code-meta">
                      <span>{t(days === 1 ? 'codeMetaOne' : 'codeMetaMany', { n: days })}</span>
                      <button onClick={team.createCode}>{t('newCode')}</button>
                      <button onClick={team.cancelCode}>{t('revoke')}</button>
                    </div>
                  </>
                ) : (
                  <button className="btn wide" onClick={team.createCode}>
                    {t('createCode')}
                  </button>
                )}

                <div className="members">
                  {team.members.map((m) => (
                    <div className="member" key={m.id}>
                      <Avatar m={m} />
                      <span>{m.id === me ? t('you', { name: m.name }) : m.name}</span>
                      <span>{m.email}</span>
                    </div>
                  ))}
                </div>

                {alone && (
                  <form className="join" onSubmit={(e) => (e.preventDefault(), join())}>
                    <p className="join-title">{t('invited')}</p>
                    <div className="row-form">
                      <input
                        placeholder="XXXX-XXXX"
                        value={joinCode}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => (setJoinCode(e.target.value.toUpperCase()), setError(null))}
                      />
                      <button className="btn" disabled={joinCode.replace(/[^A-Z0-9]/gi, '').length < 8 || busy}>
                        {t('join')}
                      </button>
                    </div>
                    <p className="join-hint">{t('joinHint')}</p>
                  </form>
                )}
                {error && <p className="pop-msg err">{error}</p>}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
