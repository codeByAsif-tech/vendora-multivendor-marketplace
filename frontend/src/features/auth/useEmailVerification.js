import { useState } from 'react'
import toast from 'react-hot-toast'
import { useDispatch } from 'react-redux'
import { getErrorMessage } from '@/utils/apiError'
import { authApi, useResendVerificationMutation } from './authApi'
import { userUpdated } from './authSlice'
import { useAuth } from './useAuth'

/**
 * Shared by the reminder bar, the account page and the "verify first" popup.
 * resend() emails a new link (the API allows one a minute). If the email was verified meanwhile
 * (e.g. in another tab), it reloads the account instead, so the reminders disappear.
 */
export function useEmailVerification() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [resendMutation, { isLoading: resending }] = useResendVerificationMutation()
  const [rechecking, setRechecking] = useState(false)

  async function resend() {
    try {
      const res = await resendMutation().unwrap()
      toast.success(res.message)
      return true
    } catch (error) {
      // Verified in the meantime (e.g. in another tab): refresh instead of showing an error.
      if (error?.data?.code === 'ALREADY_VERIFIED') return recheck()
      toast.error(getErrorMessage(error))
      return false
    }
  }

  async function recheck() {
    setRechecking(true)
    try {
      const fresh = await dispatch(authApi.endpoints.getMe.initiate(undefined, { forceRefetch: true })).unwrap()
      dispatch(userUpdated(fresh))
      if (fresh.emailVerified) toast.success('Your email is verified. Thank you!')
      else toast('Not verified yet. Open the link in the email we sent you.', { icon: '📧' })
      return fresh.emailVerified
    } catch (error) {
      toast.error(getErrorMessage(error))
      return false
    } finally {
      setRechecking(false)
    }
  }

  return { email: user?.email, verified: user?.emailVerified !== false, resend, resending: resending || rechecking }
}
