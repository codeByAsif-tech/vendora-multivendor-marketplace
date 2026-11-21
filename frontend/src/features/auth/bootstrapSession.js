import { refreshSession } from '@/services/baseApi'
import { sessionChecked } from './authSlice'
import { mightHaveSession } from './sessionHint'

// Module-level promise: React StrictMode runs effects twice in development, and two parallel
// refreshes with the same cookie would look like token reuse to the server.
let bootPromise = null

/** Restores the session from the refresh cookie once, on app start. */
export function bootstrapSession(store) {
  if (!bootPromise && !mightHaveSession()) {
    // Guest: nothing to restore, so skip the /auth/refresh call (and its 401).
    store.dispatch(sessionChecked())
    bootPromise = Promise.resolve(null)
  }

  if (!bootPromise) {
    const api = {
      dispatch: store.dispatch,
      getState: store.getState,
      endpoint: 'refresh',
      type: 'mutation',
      extra: undefined,
      signal: new AbortController().signal,
    }
    bootPromise = refreshSession(api, {})
      .catch(() => null)
      .finally(() => store.dispatch(sessionChecked()))
  }
  return bootPromise
}
