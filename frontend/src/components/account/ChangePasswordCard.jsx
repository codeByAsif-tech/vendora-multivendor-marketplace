import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import PasswordChecklist from '@/components/common/PasswordChecklist'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { useChangePasswordMutation } from '@/features/auth/authApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { passwordProblem } from '@/utils/password'

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' }


export default function ChangePasswordCard() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const weak = form.newPassword && passwordProblem(form.newPassword)
  const mismatch = form.confirm && form.confirm !== form.newPassword
  const canSubmit = form.currentPassword && form.newPassword && !weak && form.confirm === form.newPassword

  async function submit(event) {
    event.preventDefault()
    setErrors({})
    try {
      const res = await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }).unwrap()
      toast.success(res.message)
      setForm(EMPTY)
    } catch (error) {
      setErrors(getFieldErrors(error))
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader title="Password" description="Changing it signs you out on every other device." action={<KeyRound className="size-5 text-brand-600" />} />
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={set('currentPassword')}
          error={errors.currentPassword}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={set('newPassword')}
            error={errors.newPassword}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            error={mismatch ? 'The passwords do not match' : undefined}
          />
        </div>
        <PasswordChecklist password={form.newPassword} />
        <div className="flex justify-end">
          <Button type="submit" loading={isLoading} disabled={!canSubmit}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  )
}
