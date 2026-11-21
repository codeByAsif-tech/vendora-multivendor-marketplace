import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'
import { useDispatch } from 'react-redux'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useVerifyEmailMutation } from '@/features/auth/authApi'
import { userUpdated } from '@/features/auth/authSlice'
import { useAuth } from '@/features/auth/useAuth'
import { useEmailLinkToken } from '@/features/auth/useEmailLinkToken'
import AuthLayout from '@/layouts/AuthLayout'
import { getErrorMessage } from '@/utils/apiError'
import { ROLES } from '@/utils/roles'

const HOME = { [ROLES.SELLER]: '/seller/dashboard', [ROLES.ADMIN]: '/admin/dashboard' }

/** Opened from the verification email. Works signed in or not. */
export default function VerifyEmailPage() {
  const token = useEmailLinkToken()
  const dispatch = useDispatch()
  const { user, isAuthenticated } = useAuth()
  const [verify] = useVerifyEmailMutation()
  const [state, setState] = useState(token ? { status: 'loading' } : { status: 'error', message: 'This link is missing its code. Please use the full link from the email.' })
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return // StrictMode runs effects twice; the link works only once
    started.current = true
    verify(token)
      .unwrap()
      .then((res) => {
        setState({ status: 'done', role: res.data.user.role })
        if (user && String(user._id) === String(res.data.user._id)) dispatch(userUpdated(res.data.user))
      })
      .catch((error) => setState({ status: 'error', message: getErrorMessage(error) }))
  }, [token, verify, dispatch, user])

  const role = state.role ?? user?.role
  const next = isAuthenticated ? (HOME[role] ?? '/') : '/login'

  return (
    <AuthLayout portal="customer" heading="Almost there." subheading="Confirming your email keeps your account safe.">
      {state.status === 'loading' && (
        <div className="flex items-center gap-3 text-slate-600">
          <Spinner className="size-5 text-brand-600" /> Verifying your email…
        </div>
      )}
      {state.status === 'done' && (
        <div>
          <CircleCheck className="size-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Email verified</h1>
          <p className="mt-2 text-sm text-slate-600">Thank you! Your account is all set.</p>
          <Button to={next} size="lg" className="mt-6">
            {isAuthenticated ? 'Continue' : 'Sign in'}
          </Button>
        </div>
      )}
      {state.status === 'error' && (
        <div>
          <CircleX className="size-12 text-rose-600" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">This link did not work</h1>
          <p className="mt-2 text-sm text-slate-600">{state.message}</p>
          <p className="mt-2 text-sm text-slate-600">
            {isAuthenticated ? 'Use the “Resend email” button in the yellow bar to get a new link.' : 'Sign in, then ask for a new link from the yellow bar at the top.'}
          </p>
          <Button to={next} variant="outline" className="mt-6">
            {isAuthenticated ? 'Continue' : 'Sign in'}
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
