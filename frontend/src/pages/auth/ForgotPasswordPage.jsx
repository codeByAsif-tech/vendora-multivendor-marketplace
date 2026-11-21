import { useState } from 'react'
import { MailCheck, Mail } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useForgotPasswordMutation } from '@/features/auth/authApi'
import AuthLayout from '@/layouts/AuthLayout'
import { getErrorMessage } from '@/utils/apiError'
import { loginPathFor } from '@/utils/roles'

const PORTALS = ['customer', 'seller', 'admin']

export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const portal = PORTALS.includes(params.get('portal')) ? params.get('portal') : 'customer'
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [forgot, { isLoading }] = useForgotPasswordMutation()
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())

  async function submit(event) {
    event.preventDefault()
    try {
      await forgot(email.trim()).unwrap()
      setSentTo(email.trim())
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <AuthLayout portal={portal} heading="Locked out? It happens." subheading="We will email you a link to choose a new password.">
      {sentTo ? (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <MailCheck className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-600">
            If an account exists for <strong>{sentTo}</strong>, we sent a link to reset the password. It works for 60 minutes.
            Check the spam folder too.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => setSentTo(null)}>
            Use another email
          </Button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forgot your password?</h1>
          <p className="mt-2 text-sm text-slate-500">Enter the email you signed up with.</p>
          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              leftIcon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={isLoading} disabled={!validEmail}>
              Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to={loginPathFor(portal)} className="font-semibold text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
