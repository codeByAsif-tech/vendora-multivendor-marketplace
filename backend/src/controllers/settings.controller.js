import * as settingsService from '../services/platformSettings.service.js';
import { sendSuccess } from '../utils/response.js';

export async function publicSettings(_req, res) {
  return sendSuccess(res, { data: { settings: await settingsService.getPublicSettings() } });
}

export async function adminSettings(_req, res) {
  return sendSuccess(res, { data: { settings: await settingsService.getPlatformSettingsForAdmin() } });
}

export async function updateSettings(req, res) {
  const settings = await settingsService.updatePlatformSettings(req.body, req.user);
  return sendSuccess(res, { message: 'Settings saved', data: { settings } });
}
