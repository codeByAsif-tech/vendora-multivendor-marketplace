import { SellerOrder } from '../models/order.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { User } from '../models/user.model.js';
import { ORDER_STATUS, ORDER_STATUS_VALUES, ROLES } from '../utils/constants.js';
import { toObjectId } from '../utils/pagination.js';

/**
 * Sales analytics, computed live from SellerOrders (one per seller per checkout).
 * - "Sales" (GMV) = total of shipments that were not cancelled, by the day the order was placed.
 * - Days and months are Indian Standard Time, so "today" matches what the admin / seller sees.
 * Admin = whole marketplace; seller = scoped to their own shipments.
 */

export const TIMEZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGES = Object.freeze({
  '7d': { days: 7, bucket: 'day' },
  '30d': { days: 30, bucket: 'day' },
  '90d': { days: 90, bucket: 'day' },
  '12m': { months: 12, bucket: 'month' },
});

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const toDayKey = (date) => dayKey.format(date); // "2026-11-20"
const istMidnight = (key) => new Date(`${key}T00:00:00+05:30`);

/** Bucket keys for the range (oldest first) and the instant the range starts. */
export function buildWindow(range, now = new Date()) {
  const spec = RANGES[range];
  const today = toDayKey(now);

  if (spec.bucket === 'month') {
    const [year, month] = today.split('-').map(Number);
    const keys = [];
    for (let i = spec.months - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(year, month - 1 - i, 1));
      keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return { keys, from: istMidnight(`${keys[0]}-01`), to: now, bucket: 'month' };
  }

  const from = new Date(istMidnight(today).getTime() - (spec.days - 1) * DAY_MS);
  const keys = Array.from({ length: spec.days }, (_, i) => toDayKey(new Date(from.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000)));
  return { keys, from, to: now, bucket: 'day' };
}

const notCancelled = { status: { $ne: ORDER_STATUS.CANCELLED } };
const unitsExpr = { $sum: '$items.quantity' };

/** Headline numbers for one time window. */
async function totalsFor(scope, from, to) {
  const [row] = await SellerOrder.aggregate([
    { $match: { ...scope, createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        shipments: { $sum: 1 },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.CANCELLED] }, 1, 0] } },
        sales: { $sum: { $cond: [{ $ne: ['$status', ORDER_STATUS.CANCELLED] }, '$total', 0] } },
        units: { $sum: { $cond: [{ $ne: ['$status', ORDER_STATUS.CANCELLED] }, unitsExpr, 0] } },
        commission: { $sum: { $cond: [{ $ne: ['$status', ORDER_STATUS.CANCELLED] }, { $ifNull: ['$commissionAmount', 0] }, 0] } },
        earnings: { $sum: { $cond: [{ $ne: ['$status', ORDER_STATUS.CANCELLED] }, { $ifNull: ['$sellerEarning', 0] }, 0] } },
        orders: { $addToSet: { $cond: [{ $ne: ['$status', ORDER_STATUS.CANCELLED] }, '$order', null] } },
      },
    },
    {
      $project: {
        _id: 0,
        shipments: 1,
        cancelled: 1,
        sales: 1,
        units: 1,
        commission: 1,
        earnings: 1,
        orders: { $size: { $setDifference: ['$orders', [null]] } }, // distinct checkouts
      },
    },
  ]);

  const t = row ?? { shipments: 0, cancelled: 0, sales: 0, units: 0, commission: 0, earnings: 0, orders: 0 };
  return {
    ...t,
    avgOrderValue: t.orders ? Math.round(t.sales / t.orders) : 0,
    cancelRate: t.shipments ? Math.round((t.cancelled / t.shipments) * 1000) / 10 : 0, // % with 1 decimal
  };
}

/**
 * @param scope   extra $match (e.g. { seller }) — empty for the whole marketplace
 * @param options { range, withSellers }
 */
async function buildReport(scope, { range, withSellers }) {
  const { keys, from, to, bucket } = buildWindow(range);
  const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  const format = bucket === 'month' ? '%Y-%m' : '%Y-%m-%d';

  const [current, previous, [facets]] = await Promise.all([
    totalsFor(scope, from, to),
    totalsFor(scope, previousFrom, from),
    SellerOrder.aggregate([
      { $match: { ...scope, createdAt: { $gte: from, $lt: to } } },
      {
        $facet: {
          series: [
            { $match: notCancelled },
            {
              $group: {
                _id: { $dateToString: { date: '$createdAt', format, timezone: TIMEZONE } },
                sales: { $sum: '$total' },
                orders: { $addToSet: '$order' },
              },
            },
            { $project: { sales: 1, orders: { $size: '$orders' } } },
          ],
          statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          payments: [
            { $match: notCancelled },
            { $group: { _id: '$paymentMethod', shipments: { $sum: 1 }, amount: { $sum: '$total' } } },
          ],
          topProducts: [
            { $match: notCancelled },
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.product',
                name: { $last: '$items.name' },
                slug: { $last: '$items.slug' },
                image: { $last: '$items.image' },
                units: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.lineTotal' },
              },
            },
            { $sort: { revenue: -1, units: -1 } },
            { $limit: 5 },
          ],
          ...(withSellers && {
            topSellers: [
              { $match: notCancelled },
              { $group: { _id: '$store', sales: { $sum: '$total' }, shipments: { $sum: 1 } } },
              { $sort: { sales: -1 } },
              { $limit: 5 },
            ],
          }),
        },
      },
    ]),
  ]);

  // Fill days / months with no orders so the chart has a point for every bucket.
  const byKey = new Map(facets.series.map((s) => [s._id, s]));
  const series = keys.map((key) => ({ key, sales: byKey.get(key)?.sales ?? 0, orders: byKey.get(key)?.orders ?? 0 }));

  const statusCounts = Object.fromEntries(ORDER_STATUS_VALUES.map((s) => [s, 0]));
  for (const { _id, count } of facets.statuses) if (_id in statusCounts) statusCounts[_id] = count;

  const report = {
    range,
    bucket,
    from,
    to,
    totals: current,
    previous,
    series,
    statuses: statusCounts,
    payments: facets.payments.map((p) => ({ method: p._id, shipments: p.shipments, amount: p.amount })),
    topProducts: facets.topProducts.map(({ _id, ...p }) => ({ productId: _id, ...p })),
  };

  if (withSellers) {
    const stores = await SellerProfile.find({ _id: { $in: facets.topSellers.map((s) => s._id) } })
      .select('storeName slug logo')
      .lean();
    const storeById = new Map(stores.map((s) => [String(s._id), s]));
    report.topSellers = facets.topSellers.map((s) => ({
      storeId: s._id,
      storeName: storeById.get(String(s._id))?.storeName ?? 'Deleted store',
      slug: storeById.get(String(s._id))?.slug,
      sales: s.sales,
      shipments: s.shipments,
    }));
  }

  return report;
}

/** Whole marketplace, plus sign-ups in the same window. */
export async function adminReport({ range }) {
  const report = await buildReport({}, { range, withSellers: true });
  const [newCustomers, newSellers] = await Promise.all([
    User.countDocuments({ role: ROLES.CUSTOMER, createdAt: { $gte: report.from } }),
    User.countDocuments({ role: ROLES.SELLER, createdAt: { $gte: report.from } }),
  ]);
  return { ...report, signups: { customers: newCustomers, sellers: newSellers } };
}

/** One seller's own shipments only. */
export async function sellerReport(sellerId, { range }) {
  return buildReport({ seller: toObjectId(sellerId) }, { range, withSellers: false });
}
