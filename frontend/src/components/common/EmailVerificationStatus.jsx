import { BadgeCheck, MailWarning } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useEmailVerification } from '@/features/auth/useEmailVerification'

/** Verified badge, or "Not verified" with a Resend button. Used in account settings. */
export default function EmailVerificationStatus() {
  const { verified, resend, resending } = useEmailVerification()

  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <BadgeCheck className="size-4" /> Verified
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <MailWarning className="size-4" /> Not verified
      </span>
      <Button size="sm" variant="outline" onClick={resend} loading={resending}>
        Resend email
      </Button>
    </div>
  )
}
