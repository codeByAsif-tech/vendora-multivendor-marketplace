export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  SELLER: 'seller',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.values(ROLES);

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  BLOCKED: 'blocked',
});

export const USER_STATUS_VALUES = Object.values(USER_STATUS);

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

// ---- Sellers ----
export const SELLER_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});

export const SELLER_STATUS_VALUES = Object.values(SELLER_STATUS);

/** Status changes an admin may make: current status → allowed next statuses. */
export const SELLER_STATUS_TRANSITIONS = Object.freeze({
  pending: ['approved', 'rejected'],
  approved: ['suspended'],
  suspended: ['approved'],
  rejected: ['approved'],
});

export const BUSINESS_TYPES = Object.freeze([
  'individual',
  'proprietorship',
  'partnership',
  'private_limited',
  'llp',
  'other',
]);

// ---- Catalog ----
export const PRODUCT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const PRODUCT_STATUS_VALUES = Object.values(PRODUCT_STATUS);

export const PRODUCT_LIMITS = Object.freeze({
  MAX_IMAGES: 8,
  MAX_VARIANTS: 50,
  MAX_ATTRIBUTES: 3,
  DEFAULT_LOW_STOCK: 5,
});

// ---- Cart & orders ----
export const CART_LIMITS = Object.freeze({ MAX_LINES: 50, MAX_QTY_PER_LINE: 10 });

/** Per seller shipment: free above the threshold, otherwise a flat fee (paise). */
export const SHIPPING = Object.freeze({ FREE_THRESHOLD: 49900, FEE: 4900 });

export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending', // waiting for payment verification (manual payment)
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

/** Customers (and sellers) may cancel before the parcel ships. */
export const CANCELLABLE_STATUSES = Object.freeze(['pending', 'confirmed', 'processing']);

/** What a seller may change a shipment to. pending → confirmed happens through payment verification. */
export const SELLER_ORDER_TRANSITIONS = Object.freeze({
  pending: ['cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
});

/**
 * Admins do not fulfil orders (packing/shipping is the seller's job).
 * They can confirm orders waiting for payment, and cancel anything that has not shipped.
 */
export const ADMIN_ORDER_TRANSITIONS = Object.freeze({
  // pending → confirmed happens only by verifying the payment (POST /admin/payments/:id/verify)
  pending: ['cancelled'],
  confirmed: ['cancelled'],
  processing: ['cancelled'],
  shipped: [],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
});

export const PAYMENT_METHODS = Object.freeze(['cod', 'manual']);

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending', // COD: collected on delivery
  PENDING_VERIFICATION: 'pending_verification', // manual: UTR submitted, admin must verify (Phase 6)
  PAID: 'paid',
  REJECTED: 'rejected', // manual: UTR could not be matched, customer may submit a new one
  CANCELLED: 'cancelled', // nothing was collected (everything cancelled)
});

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const TRANSACTION_TYPES = Object.freeze({
  PAYMENT_RECEIVED: 'payment_received', // manual payment verified by an admin
  COD_COLLECTED: 'cod_collected', // cash collected when a COD shipment is delivered
  REFUND: 'refund', // money returned to the customer (recorded by an admin)
});

export const TRANSACTION_TYPE_VALUES = Object.values(TRANSACTION_TYPES);

// ---- Seller earnings & payouts (Phase 7) ----
/** Commission is a percentage of the item subtotal (shipping goes to the seller, who ships). */
export const COMMISSION_LIMITS = Object.freeze({ MIN: 0, MAX: 50 });

export const LEDGER_TYPES = Object.freeze({
  EARNING: 'earning', // + seller's share of a delivered shipment
  PAYOUT: 'payout', // − money sent to the seller's bank
  RETURN: 'return', // − seller's share of returned items (Phase 9)
});

export const LEDGER_TYPE_VALUES = Object.values(LEDGER_TYPES);

export const EARNING_STATUS = Object.freeze({
  ON_HOLD: 'on_hold', // delivered recently, inside the hold window
  AVAILABLE: 'available', // can be paid out
});

export const PAYOUT_METHODS = Object.freeze(['bank_transfer', 'upi']);

// ---- Reviews, coupons, returns, notifications (Phase 9) ----
export const REVIEW_STATUS = Object.freeze({ PUBLISHED: 'published', HIDDEN: 'hidden' });
export const REVIEW_STATUS_VALUES = Object.values(REVIEW_STATUS);

export const COUPON_TYPES = Object.freeze(['percent', 'fixed']);

export const RETURN_STATUS = Object.freeze({
  REQUESTED: 'requested', // customer asked, seller decides
  APPROVED: 'approved', // customer sends the items back
  REJECTED: 'rejected',
  RECEIVED: 'received', // seller got the items: stock back, refund due, seller earning reduced
});
export const RETURN_STATUS_VALUES = Object.values(RETURN_STATUS);
export const OPEN_RETURN_STATUSES = Object.freeze(['requested', 'approved']);

export const RETURN_REASONS = Object.freeze({
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item sent',
  not_as_described: 'Not as described',
  size_fit: 'Size or fit issue',
  quality: 'Quality not as expected',
  other: 'Other',
});

export const ADDRESS_TYPES = Object.freeze(['home', 'work', 'other']);
export const MAX_ADDRESSES = 10;

// ---- Uploads ----
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
