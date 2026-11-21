import { useEffect, useState } from 'react'

/**
 * Reads ?token= from an email link, then removes it from the address bar,
 * so the one-time code is not left in the browser history or shared by copying the URL.
 * (Reading is pure and removal happens in an effect, so React's double calls in development are harmless.)
 */
export function useEmailLinkToken() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'))

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token')) return
    url.searchParams.delete('token')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])

  return token
}
