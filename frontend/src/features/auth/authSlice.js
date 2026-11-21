import { createSlice } from '@reduxjs/toolkit'

// The access token lives only in memory (never localStorage) to limit XSS exposure.
// After a page reload the session is restored from the httpOnly refresh cookie.
const initialState = {
  user: null,
  accessToken: null,
  initialized: false, // true once the startup session check has finished
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsUpdated(state, action) {
      const { user, accessToken } = action.payload
      if (user) state.user = user
      if (accessToken) state.accessToken = accessToken
    },
    userUpdated(state, action) {
      state.user = action.payload
    },
    loggedOut(state) {
      state.user = null
      state.accessToken = null
    },
    sessionChecked(state) {
      state.initialized = true
    },
  },
})

export const { credentialsUpdated, userUpdated, loggedOut, sessionChecked } = authSlice.actions
export default authSlice.reducer

export const selectCurrentUser = (state) => state.auth.user
export const selectIsAuthenticated = (state) => Boolean(state.auth.accessToken && state.auth.user)
export const selectAuthInitialized = (state) => state.auth.initialized
