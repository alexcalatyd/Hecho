import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { type Cloud } from './App.tsx'
import { Login, NewPassword } from './components/Login.tsx'
import { supabase, useSession, useRecovery, isNative } from './lib/supabase'
import { useT } from './lib/i18n'
import './lib/theme'

const native = (window as any).webkit?.messageHandlers?.native
if (isNative) document.documentElement.classList.add('native')

/** Decide qué mostrar: modo local, login o la app con los espacios del usuario */
function Root() {
  const session = useSession()
  const recovering = useRecovery()
  const uid = session?.user.id
  const [cloud, setCloud] = useState<Cloud | null>(() => {
    try {
      return uid ? JSON.parse(localStorage.getItem(`hecho:boot:${uid}`) ?? 'null') : null
    } catch {
      return null
    }
  })
  const [error, setError] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!supabase || !uid) return
    setError(false)
    try {
      setCloud(JSON.parse(localStorage.getItem(`hecho:boot:${uid}`) ?? 'null'))
    } catch {
      setCloud(null)
    }
    supabase.rpc('bootstrap').then(({ data, error }) => {
      if (error) return setError(true)
      setCloud(data as Cloud)
      localStorage.setItem(`hecho:boot:${uid}`, JSON.stringify(data))
    })
  }, [uid])

  if (!supabase) return <App userId="me" cloud={null} />
  if (session === undefined) return null
  if (!session) return <Login />
  if (recovering) return <NewPassword />
  if (!cloud)
    return error ? (
      <div className="login">
        <p className="login-error">{t('errBoot')}</p>
      </div>
    ) : null
  return <App key={uid} userId={uid!} cloud={cloud} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {native && <div className="drag" onMouseDown={(e) => e.button === 0 && native.postMessage('drag')} />}
    <Root />
  </StrictMode>,
)
