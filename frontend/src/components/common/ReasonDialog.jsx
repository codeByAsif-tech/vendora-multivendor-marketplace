import { useState } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'

/**
 * Asks for a reason before a negative action (reject, suspend, block).
 * Render it conditionally ({open && <ReasonDialog open … />}) so the text resets each time.
 */
export default function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  placeholder = 'Explain the reason. The user will see this.',
  loading = false,
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const valid = reason.trim().length >= 5

  function submit() {
    setTouched(true)
    if (valid) onConfirm(reason.trim())
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        rows={4}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        error={touched && !valid ? 'Please enter at least 5 characters' : undefined}
        hint={`${reason.length}/500`}
        autoFocus
      />
    </Modal>
  )
}
