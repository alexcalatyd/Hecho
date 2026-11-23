import { useSyncExternalStore } from 'react'

export type Lang = 'es' | 'en'

const es = {
  // espacios
  personal: 'Personal',
  shared: 'Compartida',
  defaultPersonalList: 'General',
  defaultSharedList: 'Juntos',

  // árbol
  newList: 'Nueva lista',
  newGroup: 'Nuevo grupo',
  newSubgroup: 'Nuevo subgrupo',
  rename: 'Renombrar',
  deleteGroup: 'Eliminar grupo',
  deleteList: 'Eliminar lista',
  addList: 'Añadir lista',
  list: 'Lista',
  group: 'Grupo',
  select: 'Seleccionar',
  done: 'Listo',
  selectHint: 'Seleccionar (o ⌘-clic)',
  endSelect: 'Terminar selección',
  moreOptions: 'Más opciones',

  // lista
  noLists: 'Sin listas',
  noListsText: 'Crea una lista o un grupo para empezar a organizarte.',
  nothingPending: 'Nada pendiente',
  pendingOne: '{n} pendiente',
  pendingMany: '{n} pendientes',
  newTask: 'Nueva tarea',
  addShared: 'Añadir a la lista compartida',
  emptySharedTitle: 'Una lista para dos',
  emptySharedText: 'Lo que añadáis aquí lo veréis los dos, al momento.',
  emptyTitle: 'Todo hecho',
  emptyText: 'Escribe arriba lo siguiente que quieras quitarte de encima.',
  completed: 'Completadas · {n}',
  clear: 'Borrar',
  add: 'Añadir',
  complete: 'Completar',
  delete: 'Eliminar',
  p0: 'Sin prioridad',
  p1: 'Prioridad baja',
  p2: 'Prioridad media',
  p3: 'Prioridad alta',
  clickToChange: 'clic para cambiar',

  // selección
  items: '{n} elementos',
  itemOne: '{n} elemento',
  taskOne: '{n} tarea',
  taskMany: '{n} tareas',
  tapToSelect: 'Toca para seleccionar',
  move: 'Mover',
  moveTo: 'Mover a',
  noOtherLists: 'No hay otras listas',
  topLevel: 'Nivel principal',
  confirmDelete: '¿Eliminar {n}?',
  cancelSelection: 'Cancelar selección',

  // compartir
  share: 'Compartir',
  shareSignIn: 'Disponible al iniciar sesión.',
  shareText: 'Pásale este código a quien quieras. Lo escribe en su Hecho y compartiréis este espacio.',
  copyCode: 'Copiar código',
  codeMetaOne: 'Un solo uso · caduca en {n} día',
  codeMetaMany: 'Un solo uso · caduca en {n} días',
  newCode: 'Nuevo',
  revoke: 'Anular',
  createCode: 'Crear código de invitación',
  you: '{name} (tú)',
  invited: '¿Te han invitado?',
  join: 'Unirme',
  joinHint: 'Lo que tengas aquí se juntará con su espacio.',
  invalidCode: 'Código no válido o caducado',
  joinFailed: 'No se ha podido entrar',
  offline: 'Sin conexión',

  // cuenta y ajustes
  myAccount: 'Mi cuenta',
  yourName: 'Tu nombre',
  signOut: 'Cerrar sesión',
  settings: 'Ajustes',
  language: 'Idioma',
  theme: 'Tema',
  themeSystem: 'Sistema',
  themeLight: 'Claro',
  themeDark: 'Oscuro',

  // login
  tagline: 'Tus tareas, en el Mac y en el móvil.',
  taglineSignup: 'Crea tu cuenta para tener tus tareas en todas partes.',
  email: 'Correo',
  password: 'Contraseña',
  passwordNew: 'Contraseña (mín. 8)',
  showPassword: 'Mostrar contraseña',
  signIn: 'Entrar',
  signUp: 'Crear cuenta',
  haveAccount: '¿Ya tienes cuenta? Entrar',
  noAccount: '¿No tienes cuenta? Crear una',
  errEmail: 'Escribe un correo válido',
  errShort: 'La contraseña necesita al menos 8 caracteres',
  errExists: 'Ya hay una cuenta con ese correo. Entra con ella.',
  errCredentials: 'Correo o contraseña incorrectos',
  errWeak: 'Esa contraseña es demasiado débil',
  errRate: 'Demasiados intentos, espera un momento',
  errConnect: 'No se ha podido conectar',
  errBoot: 'No se ha podido conectar. Revisa tu conexión y vuelve a abrir la app.',
}

export type Key = keyof typeof es

const en: Record<Key, string> = {
  personal: 'Personal',
  shared: 'Shared',
  defaultPersonalList: 'General',
  defaultSharedList: 'Together',

  newList: 'New list',
  newGroup: 'New group',
  newSubgroup: 'New subgroup',
  rename: 'Rename',
  deleteGroup: 'Delete group',
  deleteList: 'Delete list',
  addList: 'Add list',
  list: 'List',
  group: 'Group',
  select: 'Select',
  done: 'Done',
  selectHint: 'Select (or ⌘-click)',
  endSelect: 'Finish selecting',
  moreOptions: 'More options',

  noLists: 'No lists',
  noListsText: 'Create a list or a group to start getting organised.',
  nothingPending: 'Nothing pending',
  pendingOne: '{n} pending',
  pendingMany: '{n} pending',
  newTask: 'New task',
  addShared: 'Add to the shared list',
  emptySharedTitle: 'A list for two',
  emptySharedText: 'Whatever you add here, you’ll both see it instantly.',
  emptyTitle: 'All done',
  emptyText: 'Write the next thing you want off your plate above.',
  completed: 'Completed · {n}',
  clear: 'Clear',
  add: 'Add',
  complete: 'Complete',
  delete: 'Delete',
  p0: 'No priority',
  p1: 'Low priority',
  p2: 'Medium priority',
  p3: 'High priority',
  clickToChange: 'click to change',

  items: '{n} items',
  itemOne: '{n} item',
  taskOne: '{n} task',
  taskMany: '{n} tasks',
  tapToSelect: 'Tap to select',
  move: 'Move',
  moveTo: 'Move to',
  noOtherLists: 'No other lists',
  topLevel: 'Top level',
  confirmDelete: 'Delete {n}?',
  cancelSelection: 'Cancel selection',

  share: 'Share',
  shareSignIn: 'Available once you sign in.',
  shareText: 'Give this code to anyone. They type it into their Hecho and you’ll share this space.',
  copyCode: 'Copy code',
  codeMetaOne: 'Single use · expires in {n} day',
  codeMetaMany: 'Single use · expires in {n} days',
  newCode: 'New',
  revoke: 'Revoke',
  createCode: 'Create invite code',
  you: '{name} (you)',
  invited: 'Got an invite?',
  join: 'Join',
  joinHint: 'Whatever you have here will be merged into their space.',
  invalidCode: 'Invalid or expired code',
  joinFailed: 'Couldn’t join',
  offline: 'Offline',

  myAccount: 'My account',
  yourName: 'Your name',
  signOut: 'Sign out',
  settings: 'Settings',
  language: 'Language',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',

  tagline: 'Your tasks, on your Mac and your phone.',
  taglineSignup: 'Create your account to have your tasks everywhere.',
  email: 'Email',
  password: 'Password',
  passwordNew: 'Password (min. 8)',
  showPassword: 'Show password',
  signIn: 'Sign in',
  signUp: 'Create account',
  haveAccount: 'Already have an account? Sign in',
  noAccount: 'No account? Create one',
  errEmail: 'Enter a valid email',
  errShort: 'Password needs at least 8 characters',
  errExists: 'There’s already an account with that email. Sign in instead.',
  errCredentials: 'Wrong email or password',
  errWeak: 'That password is too weak',
  errRate: 'Too many attempts, wait a moment',
  errConnect: 'Couldn’t connect',
  errBoot: 'Couldn’t connect. Check your connection and reopen the app.',
}

const dict = { es, en }
const KEY = 'hecho:lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {}
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

let lang: Lang = initial()
const listeners = new Set<() => void>()
document.documentElement.lang = lang

export const getLang = () => lang

export function setLang(l: Lang) {
  lang = l
  document.documentElement.lang = l
  try {
    localStorage.setItem(KEY, l)
  } catch {}
  listeners.forEach((f) => f())
}

/** Traduce fuera de React (p. ej. nombres por defecto al crear datos) */
export function tr(k: Key, vars?: Record<string, string | number>) {
  let s = dict[lang][k]
  if (vars) for (const [v, x] of Object.entries(vars)) s = s.replace(`{${v}}`, String(x))
  return s
}

export function useLang() {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    () => lang,
  )
}

/** Hook: devuelve la función de traducción y se re-renderiza al cambiar de idioma */
export function useT() {
  useLang()
  return tr
}
