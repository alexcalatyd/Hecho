import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'hecho:theme'
const listeners = new Set<() => void>()

function initial(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'system'
}

let theme: Theme = initial()

function apply() {
  const root = document.documentElement
  ;(window as any).webkit?.messageHandlers?.native?.postMessage(`theme:${theme}`)
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
  // barra de estado / color del navegador acorde al tema elegido
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const light = m.content.toLowerCase() === '#f2f2f7'
    if (theme === 'system') m.media = light ? '(prefers-color-scheme: light)' : '(prefers-color-scheme: dark)'
    else m.media = (theme === 'light') === light ? 'all' : 'not all'
  })
}
apply()

export function setTheme(t: Theme) {
  theme = t
  try {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {}
  apply()
  listeners.forEach((f) => f())
}

export function useTheme() {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    () => theme,
  )
}
