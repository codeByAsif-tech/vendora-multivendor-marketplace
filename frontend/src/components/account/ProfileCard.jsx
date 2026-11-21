import { useState } from 'react'
import { Calendar, Mail, Pencil, Phone, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import EmailVerificationStatus from '@/components/common/EmailVerificationStatus'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { useUpdateMeMutation } from '@/features/auth/authApi'
import { useAuth } from '@/features/auth/useAuth'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { formatDate } from '@/utils/format'

const ROLE_LABELS = { customer: 'Customer', seller: 'Seller', admin: 'Administrator' }

function Row({ icon: Icon, label, value, children }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Icon className="size-5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value || '—'}</p>
        {children && <div className="mt-1.5">{children}</div>}
      </div>
    </div>
  )
}

/** Name and phone can be edited (Edit button top right); email and role are shown read-only. */
export default function ProfileCard() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [errors, setErrors] = useState({})
  const [updateMe, { isLoading }] = useUpdateMeMutation()

  if (!user) return null

  function startEdit() {
    setForm({ name: user.name ?? '', phone: user.phone ?? '' })
    setErrors({})
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    const changes = {}
    if (form.name.trim() !== user.name) changes.name = form.name.trim()
    if (form.phone.trim() !== (user.phone ?? '')) changes.phone = form.phone.trim()
    if (!Object.keys(changes).length) return setEditing(false)
    try {
      await updateMe(changes).unwrap()
      toast.success('Profile updated')
      setEditing(false)
    } catch (error) {
      setErrors(getFieldErrors(error))
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Profile"
        description="Your name and contact details."
        action={
          !editing && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="size-4" /> Edit
            </Button>
          )
        }
      />
      {editing ? (
        <form onSubmit={save} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} autoFocus />
            <Input
              label="Phone (optional)"
              type="tel"
              placeholder="+919876543210"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              error={errors.phone}
            />
          </div>
          <p className="text-xs text-slate-500">Your email ({user.email}) is your sign-in and cannot be changed here.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading} disabled={form.name.trim().length < 2}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="divide-y divide-slate-100">
          <Row icon={User} label="Full name" value={user.name} />
          <Row icon={Mail} label="Email" value={user.email}>
            <EmailVerificationStatus />
          </Row>
          <Row icon={Phone} label="Phone" value={user.phone} />
          <Row icon={ShieldCheck} label="Account type" value={ROLE_LABELS[user.role] ?? user.role} />
          <Row icon={Calendar} label="Member since" value={user.createdAt && formatDate(user.createdAt)} />
        </div>
      )}
    </Card>
  )
}
