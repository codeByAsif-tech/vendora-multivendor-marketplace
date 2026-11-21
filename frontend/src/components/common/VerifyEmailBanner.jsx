import { useState } from 'react'
import { MailWarning } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useEmailVerification } from '@/features/auth/useEmailVerification'
import { ROLES } from '@/utils/roles'

/** Where the user can resend the email after pressing "Later". */
const LATER_HINT = {
  [ROLES.CUSTOMER]: 'You can resend it any time from My account.',
  [ROLES.SELLER]: 'You can resend it any time from Store settings.',
}

/** Reminder for signed-in users who have not confirmed their email yet. "Later" hides it until the next visit. */
export default function VerifyEmailBanner() {
  const { user, isAuthenticated } = useAuth()
  const { resend, resending } = useEmailVerification()
  const [hidden, setHidden] = useState(false)

  if (!isAuthenticated || !user || user.emailVerified !== false || hidden) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
        <MailWarning className="size-4 shrink-0" />
        <span className="flex-1">
          Please verify your email: we sent a link to <strong>{user.email}</strong>.{' '}
          <span className="text-amber-800">{LATER_HINT[user.role]}</span>
        </span>
        <button type="button" onClick={resend} disabled={resending} className="font-semibold underline-offset-2 hover:underline disabled:opacity-60">
          {resending ? 'Sending…' : 'Resend email'}
        </button>
        <button type="button" onClick={() => setHidden(true)} className="text-amber-800 hover:text-amber-950">
          Later
        </button>
      </div>
    </div>
  )
}
