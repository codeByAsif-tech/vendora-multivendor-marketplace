export const ORDER_STATUS_META = {
  pending: { label: 'Awaiting payment', tone: 'yellow' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  processing: { label: 'Being packed', tone: 'blue' },
  shipped: { label: 'Shipped', tone: 'brand' },
  out_for_delivery: { label: 'Out for delivery', tone: 'brand' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

export const PAYMENT_STATUS_META = {
  pending: { label: 'Payment pending', tone: 'yellow' },
  pending_verification: { label: 'Verifying payment', tone: 'yellow' },
  paid: { label: 'Paid', tone: 'green' },
  rejected: { label: 'Payment rejected', tone: 'red' },
  cancelled: { label: 'Not charged', tone: 'gray' },
}

export const PAYMENT_METHOD_LABELS = { cod: 'Cash on Delivery', manual: 'UPI / Bank transfer' }

/** Steps shown in the order timeline (cancelled is shown separately). */
export const ORDER_STEPS = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']

export const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'processing']

/** Next status buttons for sellers: [status, label]. */
export const NEXT_STEP = {
  confirmed: ['processing', 'Start packing'],
  processing: ['shipped', 'Mark as shipped'],
  shipped: ['out_for_delivery', 'Out for delivery'],
  out_for_delivery: ['delivered', 'Mark as delivered'],
}
