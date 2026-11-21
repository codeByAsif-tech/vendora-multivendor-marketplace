import { useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribe } from './themeStore'

/** { theme: 'light' | 'dark', setTheme } */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme)
  return { theme, setTheme }
}
