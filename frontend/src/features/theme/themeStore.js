/**
 * Light / dark theme.
 * - First visit: follows the device setting (prefers-color-scheme).
 * - After the user clicks the sun or moon icon: that choice is saved in localStorage.
 * The theme is applied as a "dark" class on <html>. index.html applies it before the first paint.
 */
const STORAGE_KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set()

function readSaved() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

let saved = readSaved()

function currentTheme() {
  return saved ?? (media.matches ? 'dark' : 'light')
}

function apply() {
  document.documentElement.classList.toggle('dark', currentTheme() === 'dark')
  listeners.forEach((listener) => listener())
}

export function setTheme(theme) {
  saved = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
  apply()
}

// Follow the device setting until the user picks a theme.
media.addEventListener('change', () => {
  if (!saved) apply()
})

// Keep other open tabs in sync.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  saved = readSaved()
  apply()
})

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTheme() {
  return currentTheme()
}

apply()
