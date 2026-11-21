import * as commissionService from '../services/commission.service.js';
import * as earningsService from '../services/earnings.service.js';
import { sendSuccess } from '../utils/response.js';

// ---- Seller ----
export async function myWallet(req, res) {
  return sendSuccess(res, { data: { wallet: await earningsService.getMyWallet(req.user.id) } });
}

export async function myLedger(req, res) {
  return sendSuccess(res, { data: await earningsService.listMyLedger(req.user.id, req.validatedQuery) });
}

export async function myPayouts(req, res) {
  return sendSuccess(res, { data: await earningsService.listMyPayouts(req.user.id, req.validatedQuery) });
}

// ---- Admin ----
export async function getCommission(_req, res) {
  return sendSuccess(res, { data: { settings: await commissionService.getCommissionSettings() } });
}

export async function updateCommission(req, res) {
  const settings = await commissionService.setDefaultRate(req.body, req.user);
  return sendSuccess(res, { message: 'Commission updated. It applies to new orders.', data: { settings } });
}

export async function updateStoreCommission(req, res) {
  const store = await commissionService.setStoreRate(req.params.id, req.body);
  const message =
    store.commissionRate == null ? 'Seller now uses the platform rate' : `Seller commission set to ${store.commissionRate}%`;
  return sendSuccess(res, { message, data: { seller: store } });
}

export async function listBalances(req, res) {
  return sendSuccess(res, { data: await earningsService.listBalances(req.validatedQuery) });
}

export async function createPayout(req, res) {
  const payout = await earningsService.createPayout(req.body, req.user);
  return sendSuccess(res, { status: 201, message: 'Payout recorded and seller notified', data: { payout } });
}

export async function listPayouts(req, res) {
  return sendSuccess(res, { data: await earningsService.listPayouts(req.validatedQuery) });
}
