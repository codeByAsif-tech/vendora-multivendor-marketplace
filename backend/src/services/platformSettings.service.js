import { env } from '../config/env.js';
import { Setting } from '../models/setting.model.js';
import { SHIPPING } from '../utils/constants.js';

/**
 * Admin-editable platform settings (key 'platform' in the Setting collection).
 * Missing values fall back to the defaults below, so a fresh database works without any setup.
 * Read on every cart / checkout, so the value is cached for a short time (never in tests).
 */
const KEY = 'platform';
const CACHE_MS = 30_000;

export const DEFAULT_SETTINGS = Object.freeze({
  shipping: {
    fee: SHIPPING.FEE, // paise, per seller shipment
    freeThreshold: SHIPPING.FREE_THRESHOLD, // paise; shipments at or above this ship free
    firstOrderFree: true, // a customer's first order ships free
  },
  announcement: {
    message: '', // optional custom text for the storefront top bar ('' = automatic delivery offer)
  },
  support: {
    email: '',
    phone: '',
  },
});

let cache = null;

function merge(saved = {}) {
  return {
    shipping: { ...DEFAULT_SETTINGS.shipping, ...saved.shipping },
    announcement: { ...DEFAULT_SETTINGS.announcement, ...saved.announcement },
    support: { ...DEFAULT_SETTINGS.support, ...saved.support },
  };
}

export async function getPlatformSettings() {
  if (!env.isTest && cache && cache.expires > Date.now()) return cache.value;
  const setting = await Setting.findOne({ key: KEY }).lean();
  const value = merge(setting?.value);
  cache = { value, expires: Date.now() + CACHE_MS };
  return value;
}

/** Admin view: values plus who changed them last. */
export async function getPlatformSettingsForAdmin() {
  const setting = await Setting.findOne({ key: KEY }).populate('updatedBy', 'name').lean();
  return {
    ...merge(setting?.value),
    updatedAt: setting?.updatedAt ?? null,
    updatedBy: setting?.updatedBy ?? null,
    readOnly: { earningsHoldDays: env.EARNINGS_HOLD_DAYS, uploadDriver: env.UPLOAD_DRIVER },
  };
}

/** Saves the sections sent (each section is merged with what is saved). */
export async function updatePlatformSettings(patch, admin) {
  const current = merge((await Setting.findOne({ key: KEY }).lean())?.value);
  const next = {
    shipping: { ...current.shipping, ...patch.shipping },
    announcement: { ...current.announcement, ...patch.announcement },
    support: { ...current.support, ...patch.support },
  };
  await Setting.updateOne({ key: KEY }, { $set: { value: next, updatedBy: admin.id } }, { upsert: true });
  cache = null;
  return getPlatformSettingsForAdmin();
}

/** What the storefront needs (no internal values). */
export async function getPublicSettings() {
  const { shipping, announcement, support } = await getPlatformSettings();
  return { shipping, announcement, support };
}
