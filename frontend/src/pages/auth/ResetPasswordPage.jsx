import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import PasswordChecklist from '@/components/common/PasswordChecklist'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useResetPasswordMutation } from '@/features/auth/authApi'
import { useEmailLinkToken } from '@/features/auth/useEmailLinkToken'
import AuthLayout from '@/layouts/AuthLayout'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { passwordProblem } from '@/utils/password'
import { loginPathFor } from '@/utils/roles'


export default function ResetPasswordPage() {
  const token = useEmailLinkToken()
  const navigate = useNavigate()
  const [reset, { isLoading }] = useResetPasswordMutation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [linkError, setLinkError] = useState(token ? null : 'This link is missing its code. Please use the full link from the email.')

  const problem = passwordProblem(password)
  const mismatch = confirm && confirm !== password
  const canSubmit = !problem && confirm === password

  async function submit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit) return
    try {
      const res = await reset({ token, password }).unwrap()
      toast.success(res.message)
      navigate(loginPathFor(res.data?.role), { replace: true })
    } catch (error) {
      if (error?.data?.code === 'TOKEN_INVALID') setLinkError(getErrorMessage(error))
      else toast.error(getFieldErrors(error).password ?? getErrorMessage(error))
    }
  }

  return (
    <AuthLayout portal="customer" heading="A fresh start." subheading="Choose a new password. You will be signed out on every device.">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      {linkError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{linkError}</p>
          <Link to="/forgot-password" className="mt-2 inline-block font-semibold text-rose-900 underline">
            Send me a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            leftIcon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={touched && problem ? problem : undefined}
          />
          <PasswordChecklist password={password} className="-mt-3" />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            leftIcon={Lock}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? 'The passwords do not match' : undefined}
          />
          <Button type="submit" size="lg" fullWidth loading={isLoading}>
            Save new password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
