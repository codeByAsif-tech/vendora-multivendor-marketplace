import { MailWarning } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useEmailVerification } from '@/features/auth/useEmailVerification'

/** Shown when the server refuses an action with EMAIL_NOT_VERIFIED (placing an order, submitting a store). */
export default function VerifyEmailModal({ open, onClose, action = 'continue' }) {
  const { email, resend, resending } = useEmailVerification()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Please verify your email"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={resend} loading={resending}>
            Resend email
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            To {action}, confirm your email first. We sent a link to <strong className="text-slate-900">{email}</strong>.
          </p>
          <p>Open the link (check spam too), then try again. No email? Press “Resend email”.</p>
        </div>
      </div>
    </Modal>
  )
}
