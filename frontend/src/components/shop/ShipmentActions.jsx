import { useState } from 'react'
import { ArrowRight, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ReasonDialog from '@/components/common/ReasonDialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { getErrorMessage } from '@/utils/apiError'
import { CANCELLABLE_STATUSES, NEXT_STEP } from './orderStatusMeta'

/**
 * "Next step" + "Cancel" buttons for one shipment. Shared by the seller and admin screens.
 * `update(body)` must return an RTK mutation promise.
 * role="seller": packing / shipping / delivery steps + cancel.
 * role="admin": cancel only. Fulfilment is the seller's job; pending orders are confirmed by verifying the payment.
 */
export default function ShipmentActions({ shipment, update, busy, role = 'seller' }) {
  const [dialog, setDialog] = useState(null) // 'ship' | 'cancel'
  const [tracking, setTracking] = useState({ carrier: '', trackingNumber: '' })

  const next = role === 'admin' ? null : NEXT_STEP[shipment.status]
  const cancellable = CANCELLABLE_STATUSES.includes(shipment.status)

  async function send(body, success) {
    try {
      await update({ id: shipment._id, ...body }).unwrap()
      toast.success(success)
      setDialog(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function goNext() {
    if (next[0] === 'shipped') setDialog('ship')
    else send({ status: next[0] }, 'Order updated')
  }

  if (!next && !cancellable) return null

  return (
    <>
      {cancellable && (
        <Button variant="outline" onClick={() => setDialog('cancel')} disabled={busy}>
          <XCircle className="size-4 text-rose-600" /> Cancel
        </Button>
      )}
      {next && (
        <Button onClick={goNext} loading={busy && dialog === null}>
          {next[1]} <ArrowRight className="size-4" />
        </Button>
      )}

      <Modal
        open={dialog === 'ship'}
        onClose={() => setDialog(null)}
        title="Mark as shipped"
        description="Add the courier and tracking number so the customer can track the parcel (optional)."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Back
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                send(
                  {
                    status: 'shipped',
                    ...(tracking.carrier.trim() ? { carrier: tracking.carrier.trim() } : {}),
                    ...(tracking.trackingNumber.trim() ? { trackingNumber: tracking.trackingNumber.trim() } : {}),
                  },
                  'Marked as shipped',
                )
              }
            >
              Mark as shipped
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Courier" placeholder="e.g. Delhivery" value={tracking.carrier} onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))} />
          <Input
            label="Tracking number"
            placeholder="e.g. DL123456789IN"
            value={tracking.trackingNumber}
            onChange={(e) => setTracking((t) => ({ ...t, trackingNumber: e.target.value }))}
          />
        </div>
      </Modal>

      {dialog === 'cancel' && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          loading={busy}
          title="Cancel this shipment?"
          description="The customer is notified and the stock goes back to inventory."
          confirmLabel="Cancel shipment"
          onConfirm={(reason) => send({ status: 'cancelled', reason }, 'Shipment cancelled')}
        />
      )}
    </>
  )
}
