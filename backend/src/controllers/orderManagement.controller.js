import * as sellerOrderService from '../services/sellerOrder.service.js';
import { sendSuccess } from '../utils/response.js';

// ---- Seller ----
export async function listSellerOrders(req, res) {
  return sendSuccess(res, { data: await sellerOrderService.listSellerOrders(req.user.id, req.validatedQuery) });
}

/** Used by sellers (own shipments only) and admins (any shipment). */
export async function getShipment(req, res) {
  return sendSuccess(res, { data: { order: await sellerOrderService.getSellerOrder(req.user, req.params.id) } });
}

export async function updateShipmentStatus(req, res) {
  const order = await sellerOrderService.updateSellerOrderStatus(req.user, req.params.id, req.body);
  return sendSuccess(res, { message: 'Order status updated', data: { order } });
}

// ---- Admin ----
export async function listAllOrders(req, res) {
  return sendSuccess(res, { data: await sellerOrderService.listAllOrders(req.validatedQuery) });
}

export async function getOrderForAdmin(req, res) {
  return sendSuccess(res, { data: { order: await sellerOrderService.getOrderForAdmin(req.params.id) } });
}
