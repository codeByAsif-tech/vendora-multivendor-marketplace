import { env } from '../config/env.js';
import { Setting } from '../models/setting.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { ApiError } from '../utils/ApiError.js';

const KEY = 'commission';

/** Platform default commission rate (%). Falls back to DEFAULT_COMMISSION_RATE until an admin saves one. */
export async function getDefaultRate(session) {
  const setting = await Setting.findOne({ key: KEY }).session(session ?? null).lean();
  return setting?.value?.defaultRate ?? env.DEFAULT_COMMISSION_RATE;
}

export async function getCommissionSettings() {
  const setting = await Setting.findOne({ key: KEY }).populate('updatedBy', 'name').lean();
  return {
    defaultRate: setting?.value?.defaultRate ?? env.DEFAULT_COMMISSION_RATE,
    holdDays: env.EARNINGS_HOLD_DAYS,
    updatedAt: setting?.updatedAt ?? null,
    updatedBy: setting?.updatedBy ?? null,
  };
}

/** New rate applies to orders placed from now on; existing orders keep the rate they were placed with. */
export async function setDefaultRate({ defaultRate }, admin) {
  await Setting.updateOne(
    { key: KEY },
    { $set: { value: { defaultRate }, updatedBy: admin.id } },
    { upsert: true },
  );
  return getCommissionSettings();
}

/** Per-store override. `rate: null` puts the store back on the platform default. */
export async function setStoreRate(storeId, { rate }) {
  const store = await SellerProfile.findByIdAndUpdate(storeId, { $set: { commissionRate: rate } }, { new: true });
  if (!store) throw ApiError.notFound('Seller not found');
  return store;
}

/** The rate a store pays right now. */
export function effectiveRate(store, defaultRate) {
  return store?.commissionRate ?? defaultRate;
}

/** Map of storeId → rate (%) for checkout. */
export async function ratesForStores(storeIds, session) {
  const defaultRate = await getDefaultRate(session);
  const stores = await SellerProfile.find({ _id: { $in: storeIds } })
    .select('commissionRate')
    .session(session ?? null)
    .lean();
  const rates = new Map(storeIds.map((id) => [String(id), defaultRate]));
  for (const store of stores) rates.set(String(store._id), effectiveRate(store, defaultRate));
  return rates;
}

/**
 * Splits one shipment's money. Commission is charged on the item subtotal only;
 * the shipping fee goes to the seller, who ships the parcel.
 */
export function splitShipment({ subtotal, total }, rate) {
  const commissionAmount = Math.round((subtotal * rate) / 100);
  return { commissionRate: rate, commissionAmount, sellerEarning: total - commissionAmount };
}
