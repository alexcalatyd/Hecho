import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { supabase, authRedirect, isNative, linkError, endRecovery } from '../lib/supabase'
import { ease } from './ui'
import { useT, getLang, type Key } from '../lib/i18n'
import { LangSwitch } from './Settings'

type Mode = 'signin' | 'signup' | 'forgot' | 'check'

const swap = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
}

function errKey(error: { code?: string; status?: number }): Key {
  if (error.code === 'invalid_credentials') return 'errCredentials'
  if (error.code === 'weak_password') return 'errWeak'
  if (error.code === 'same_password') return 'errSamePassword'
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') return 'errRate'
  return 'errConnect'
}

function PasswordInput({ value, onChange, isNew, autoFocus }: { value: string; onChange: (v: string) => void; isNew: boolean; autoFocus?: boolean }) {
  const [show, setShow] = useState(false)
  const t = useT()
  return (
    <div className="pw">
      <input
        type={show ? 'text' : 'password'}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        autoFocus={autoFocus}
        placeholder={isNew ? t('passwordNew') : t('password')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={t('showPassword')}>
        {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  )
}

function Shell({ sub, subKey, children }: { sub: React.ReactNode; subKey: string; children: React.ReactNode }) {
  return (
    <div className="login">
      <div className="login-inner">
        <img className="login-logo" src="./favicon.svg" alt="" />
        <h1 className="login-title">Hecho</h1>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={subKey} className="login-sub" {...swap}>
            {sub}
          </motion.p>
        </AnimatePresence>
        {children}
        <div className="login-lang">
          <LangSwitch />
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [sent, setSent] = useState<'signup' | 'reset'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const t = useT()
  const [linkMsg, setLinkMsg] = useState(linkError)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const mail = email.trim().toLowerCase()
  const go = (m: Mode) => (setMode(m), setError(null), setNotice(null), setLinkMsg(false))
  const check = (kind: 'signup' | 'reset') => (setSent(kind), go('check'), setCooldown(30))

  const submit = async () => {
    if (!supabase || busy) return
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError(t('errEmail'))
    if (mode !== 'forgot' && password.length < 8) return setError(t('errShort'))
    setBusy(true)
    setError(null)
    setLinkMsg(false)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: authRedirect })
      setBusy(false)
      // no dice si el correo tiene cuenta: el aviso es el mismo
      if (error && (error.status === 429 || !error.status)) return setError(t(errKey(error)))
      return check('reset')
    }

    if (mode === 'signup') {
      // si el correo ya tenía cuenta, Supabase no da error: sale el mismo aviso
      const { error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { emailRedirectTo: authRedirect, data: { lang: getLang() } },
      })
      setBusy(false)
      if (error) return setError(t(errKey(error)))
      return check('signup')
    }

    const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
    setBusy(false)
    if (!error) return
    if (error.code === 'email_not_confirmed') return (setSent('signup'), go('check'))
    setError(t(errKey(error)))
  }

  const resend = async () => {
    if (!supabase || busy || cooldown > 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error } =
      sent === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email: mail, options: { emailRedirectTo: authRedirect } })
        : await supabase.auth.resetPasswordForEmail(mail, { redirectTo: authRedirect })
    setBusy(false)
    if (error && (error.status === 429 || !error.status)) return setError(t(errKey(error)))
    setNotice(t('resent'))
    setCooldown(30)
  }

  if (mode === 'check')
    return (
      <Shell subKey="check" sub={t(sent === 'signup' ? 'checkSignup' : 'checkReset', { email: mail })}>
        <div className="login-check">
          <MailCheck size={20} strokeWidth={2} />
          <span>{t('checkTitle')}</span>
        </div>
        {isNative && <p className="login-hint">{t('checkNative')}</p>}
        <button className="btn login-btn" onClick={resend} disabled={busy || cooldown > 0}>
          {busy ? <Loader2 size={17} className="spin" /> : cooldown > 0 ? t('resendIn', { n: cooldown }) : t('resend')}
        </button>
        <p className={`login-error ${notice ? 'ok' : ''}`} aria-live="polite">
          {error ?? notice}
        </p>
        <button className="login-switch" onClick={() => go('signin')}>
          {t('backToSignIn')}
        </button>
      </Shell>
    )

  const sub = mode === 'signup' ? t('taglineSignup') : mode === 'forgot' ? t('taglineForgot') : t('tagline')

  return (
    <Shell subKey={mode} sub={sub}>
      <form className="login-form" onSubmit={(e) => (e.preventDefault(), submit())}>
        <div className="fields solid">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder={t('email')}
            value={email}
            onChange={(e) => (setEmail(e.target.value), setError(null))}
          />
          {mode !== 'forgot' && <PasswordInput value={password} onChange={(v) => (setPassword(v), setError(null))} isNew={mode === 'signup'} />}
        </div>
        <button type="submit" className="btn login-btn" disabled={!email.trim() || (mode !== 'forgot' && !password) || busy}>
          {busy ? <Loader2 size={17} className="spin" /> : mode === 'signup' ? t('signUp') : mode === 'forgot' ? t('sendLink') : t('signIn')}
        </button>
      </form>

      <p className="login-error" aria-live="polite">
        {error ?? (linkMsg ? t('errLink') : null)}
      </p>
      {mode === 'signin' && (
        <button className="login-switch subtle" onClick={() => go('forgot')}>
          {t('forgot')}
        </button>
      )}
      <button className="login-switch" onClick={() => go(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? t('noAccount') : mode === 'signup' ? t('haveAccount') : t('backToSignIn')}
      </button>
    </Shell>
  )
}

/** Tras abrir el enlace del correo: contraseña nueva antes de entrar a la app */
export function NewPassword() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  const submit = async () => {
    if (!supabase || busy) return
    if (password.length < 8) return setError(t('errShort'))
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(t(errKey(error)))
    endRecovery()
  }

  return (
    <Shell subKey="new" sub={t('taglineNewPassword')}>
      <form className="login-form" onSubmit={(e) => (e.preventDefault(), submit())}>
        <div className="fields solid">
          <PasswordInput value={password} onChange={(v) => (setPassword(v), setError(null))} isNew autoFocus />
        </div>
        <button type="submit" className="btn login-btn" disabled={!password || busy}>
          {busy ? <Loader2 size={17} className="spin" /> : t('savePassword')}
        </button>
      </form>
      <p className="login-error" aria-live="polite">
        {error}
      </p>
    </Shell>
  )
}
