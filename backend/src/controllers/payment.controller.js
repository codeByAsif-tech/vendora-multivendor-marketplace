import * as paymentService from '../services/payment.service.js';
import { sendSuccess } from '../utils/response.js';

// ---- Admin ----
export async function listPayments(req, res) {
  return sendSuccess(res, { data: await paymentService.listPayments(req.validatedQuery) });
}

export async function getPayment(req, res) {
  return sendSuccess(res, { data: { payment: await paymentService.getPayment(req.params.id) } });
}

export async function verifyPayment(req, res) {
  const payment = await paymentService.verifyPayment(req.params.id, req.user);
  return sendSuccess(res, { message: 'Payment verified and order confirmed', data: { payment } });
}

export async function rejectPayment(req, res) {
  const payment = await paymentService.rejectPayment(req.params.id, req.body, req.user);
  return sendSuccess(res, { message: 'Payment rejected. The customer was asked for a new reference.', data: { payment } });
}

export async function recordRefund(req, res) {
  const payment = await paymentService.recordRefund(req.params.id, req.body, req.user);
  return sendSuccess(res, { message: 'Refund recorded', data: { payment } });
}

export async function listTransactions(req, res) {
  return sendSuccess(res, { data: await paymentService.listTransactions(req.validatedQuery) });
}

// ---- Customer ----
export async function resubmitPayment(req, res) {
  const payment = await paymentService.resubmitPayment(req.user, req.params.orderNumber, req.body);
  return sendSuccess(res, { message: 'Thanks! We will verify your payment shortly.', data: { payment } });
}
