export const RETURN_STATUS_META = {
  requested: { label: 'Return requested', tone: 'yellow' },
  approved: { label: 'Return approved', tone: 'blue' },
  rejected: { label: 'Return declined', tone: 'red' },
  received: { label: 'Returned', tone: 'green' },
}

export const RETURN_REASONS = {
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item sent',
  not_as_described: 'Not as described',
  size_fit: 'Size or fit issue',
  quality: 'Quality not as expected',
  other: 'Other',
}

/** Reasons where the customer must describe the problem (matches the API). */
export const REASONS_NEEDING_DETAILS = ['damaged', 'wrong_item', 'not_as_described', 'other']

export const OPEN_RETURN_STATUSES = ['requested', 'approved']

const DAY_MS = 24 * 60 * 60 * 1000

/** Last moment a delivered shipment can be returned, or null. */
export function returnDeadline(shipment, windowDays) {
  if (shipment.status !== 'delivered' || !shipment.deliveredAt || windowDays == null) return null
  return new Date(new Date(shipment.deliveredAt).getTime() + windowDays * DAY_MS)
}
