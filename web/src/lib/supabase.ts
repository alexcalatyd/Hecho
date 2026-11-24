import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState, useSyncExternalStore } from 'react'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isNative = !!(window as any).webkit?.messageHandlers?.native

/** Adónde llevan los enlaces de los correos. La app del Mac no puede recibirlos: van a la web. */
export const authRedirect = isNative
  ? ((import.meta.env.VITE_WEB_URL as string | undefined) ?? 'https://hecho-app.vercel.app/')
  : location.origin + location.pathname

/* ------------------------------------------------------------------ vuelta desde un enlace del correo
 * Se lee antes de crear el cliente, que limpia la URL al procesarla. */

const RECOVERY_KEY = 'hecho:recovery'
const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1))

/** El enlace había caducado o ya se usó: lo dice el login */
export const linkError = !!(params.get('error') || params.get('error_code'))
if (linkError) history.replaceState(null, '', location.pathname)

let recovering = (() => {
  try {
    if (params.get('type') === 'recovery' && params.get('access_token')) sessionStorage.setItem(RECOVERY_KEY, '1')
    return sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return params.get('type') === 'recovery'
  }
})()
const recoveryListeners = new Set<() => void>()

/** Llegó con un enlace para cambiar la contraseña: hay que pedirla antes de entrar */
export function useRecovery() {
  return useSyncExternalStore(
    (f) => (recoveryListeners.add(f), () => recoveryListeners.delete(f)),
    () => recovering,
  )
}

export function endRecovery() {
  recovering = false
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {}
  recoveryListeners.forEach((f) => f())
}

/** null = modo local (sin base de datos), todo en localStorage */
export const supabase =
  url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'implicit', detectSessionInUrl: true } })
    : null

supabase?.auth.onAuthStateChange((e) => {
  if (e === 'PASSWORD_RECOVERY' && !recovering) {
    recovering = true
    try {
      sessionStorage.setItem(RECOVERY_KEY, '1')
    } catch {}
    recoveryListeners.forEach((f) => f())
  }
  if (e === 'SIGNED_OUT' && recovering) endRecovery()
})

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session // undefined = cargando
}

/** Lo que se queda en el dispositivo al cerrar sesión: idioma, tema y grupos plegados */
const KEEP = new Set(['hecho:lang', 'hecho:theme', 'hecho:collapsed'])

/** Cierra sesión solo en este dispositivo (funciona sin conexión) y borra la caché y lo que tenías abierto */
export async function signOut() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('hecho:') && !KEEP.has(k))
      .forEach((k) => localStorage.removeItem(k))
  } catch {}
  endRecovery()
  await supabase?.auth.signOut({ scope: 'local' })
}
