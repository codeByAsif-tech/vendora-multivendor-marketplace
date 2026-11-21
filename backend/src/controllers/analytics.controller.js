import * as analyticsService from '../services/analytics.service.js';
import { sendSuccess } from '../utils/response.js';

export async function adminReport(req, res) {
  return sendSuccess(res, { data: { report: await analyticsService.adminReport(req.validatedQuery) } });
}

export async function sellerReport(req, res) {
  return sendSuccess(res, { data: { report: await analyticsService.sellerReport(req.user.id, req.validatedQuery) } });
}
