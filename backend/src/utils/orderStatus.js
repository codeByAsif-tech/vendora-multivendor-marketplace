import { ORDER_STATUS, SHIPPING } from './constants.js';

const PROGRESS = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
};

/**
 * Overall order status from its shipments:
 * all cancelled → cancelled; all remaining delivered → delivered; otherwise the least advanced shipment.
 */
export function deriveOrderStatus(statuses) {
  const active = statuses.filter((s) => s !== ORDER_STATUS.CANCELLED);
  if (!active.length) return ORDER_STATUS.CANCELLED;
  if (active.every((s) => s === ORDER_STATUS.DELIVERED)) return ORDER_STATUS.DELIVERED;
  return active.reduce((least, s) => (PROGRESS[s] < PROGRESS[least] ? s : least));
}

/** Shipping fee for one seller shipment (paise). `rule` comes from the platform settings. */
export function shippingFor(subtotal, rule = { fee: SHIPPING.FEE, freeThreshold: SHIPPING.FREE_THRESHOLD }) {
  return subtotal >= rule.freeThreshold ? 0 : rule.fee;
}
