import { createContext, useContext } from 'react'
import type { DropPos } from './store'

export type Kind = 'node' | 'todo'

export interface Selection {
  kind: Kind | null
  ids: string[]
  /** modo selección (móvil): un toque selecciona en vez de abrir */
  mode: boolean
  setMode: (m: boolean) => void
  /** devuelve true si el clic se ha usado para seleccionar */
  click: (kind: Kind, id: string, e: React.MouseEvent) => boolean
  isPicked: (kind: Kind, id: string) => boolean
  clear: () => void
  /** arrastre en curso */
  dragging: { kind: Kind; ids: string[] } | null
  drop: { id: string; pos: DropPos } | null
}

export const SelectionCtx = createContext<Selection>(null!)
export const useSelection = () => useContext(SelectionCtx)
