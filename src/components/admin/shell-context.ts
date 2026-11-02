import { useOutletContext } from 'react-router-dom'

export interface ShellContext {
  /** true when the first tab is the active one (its top-left flows into the content) */
  firstTabActive: boolean
  /** Opens a new tab with the given path */
  openTab: (path: string) => void
}

export const useShell = () => useOutletContext<ShellContext>()
