import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ease } from './ui'
import { useT } from '../lib/i18n'
import { LangSwitch } from './Settings'

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signup = mode === 'signup'
  const t = useT()

  const submit = async () => {
    if (!supabase || busy) return
    const mail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError(t('errEmail'))
    if (password.length < 8) return setError(t('errShort'))
    setBusy(true)
    setError(null)
    const { error } = signup
      ? await supabase.auth.signUp({ email: mail, password })
      : await supabase.auth.signInWithPassword({ email: mail, password })
    setBusy(false)
    if (!error) return
    if (error.code === 'user_already_exists') return setError(t('errExists'))
    if (error.code === 'invalid_credentials') return setError(t('errCredentials'))
    if (error.code === 'weak_password') return setError(t('errWeak'))
    if (error.status === 429) return setError(t('errRate'))
    setError(t('errConnect'))
  }

  return (
    <div className="login">
      <div className="login-inner">
        <img className="login-logo" src="./favicon.svg" alt="" />
        <h1 className="login-title">Hecho</h1>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={mode}
            className="login-sub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
          >
            {signup ? t('taglineSignup') : t('tagline')}
          </motion.p>
        </AnimatePresence>

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
            <div className="pw">
              <input
                type={show ? 'text' : 'password'}
                autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={signup ? t('passwordNew') : t('password')}
                value={password}
                onChange={(e) => (setPassword(e.target.value), setError(null))}
              />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={t('showPassword')}>
                {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn login-btn" disabled={!email.trim() || !password || busy}>
            {busy ? <Loader2 size={17} className="spin" /> : signup ? t('signUp') : t('signIn')}
          </button>
        </form>

        <p className="login-error" aria-live="polite">
          {error}
        </p>
        <button className="login-switch" onClick={() => (setMode(signup ? 'signin' : 'signup'), setError(null))}>
          {signup ? t('haveAccount') : t('noAccount')}
        </button>
        <div className="login-lang">
          <LangSwitch />
        </div>
      </div>
    </div>
  )
}
