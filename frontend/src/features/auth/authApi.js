import { baseApi } from '@/services/baseApi'
import { credentialsUpdated, loggedOut, userUpdated } from './authSlice'
import { clearSession, markSession } from './sessionHint'

async function storeCredentials(_arg, { dispatch, queryFulfilled }) {
  try {
    const { data } = await queryFulfilled
    dispatch(credentialsUpdated(data.data))
    markSession()
  } catch {
    // Errors are shown by the calling form.
  }
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      onQueryStarted: storeCredentials,
    }),
    register: build.mutation({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      onQueryStarted: storeCredentials,
    }),
    registerSeller: build.mutation({
      query: (body) => ({ url: '/auth/register-seller', method: 'POST', body }),
      onQueryStarted: storeCredentials,
    }),
    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          // Log out locally even if the server call fails.
          clearSession()
          dispatch(loggedOut())
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),
    // ---- Email verification & password reset ----
    verifyEmail: build.mutation({
      query: (token) => ({ url: '/auth/verify-email', method: 'POST', body: { token } }),
      invalidatesTags: ['Me'],
    }),
    resendVerification: build.mutation({
      query: () => ({ url: '/auth/verify-email/resend', method: 'POST' }),
    }),
    forgotPassword: build.mutation({
      query: (email) => ({ url: '/auth/forgot-password', method: 'POST', body: { email } }),
    }),
    resetPassword: build.mutation({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    // ---- Own profile ----
    updateMe: build.mutation({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(userUpdated(data.data.user)) // header, menus and pages show the new name at once
        } catch {
          // shown by the form
        }
      },
      invalidatesTags: ['Me'],
    }),
    changePassword: build.mutation({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
      // New tokens for this device (other devices were signed out)
      onQueryStarted: storeCredentials,
    }),
    getMe: build.query({
      query: () => '/auth/me',
      transformResponse: (response) => response.data.user,
      providesTags: ['Me'],
    }),
  }),
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useRegisterSellerMutation,
  useLogoutMutation,
  useGetMeQuery,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useUpdateMeMutation,
  useChangePasswordMutation,
} = authApi
