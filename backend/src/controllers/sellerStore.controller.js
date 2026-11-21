import * as storeService from '../services/sellerStore.service.js';
import { sendSuccess } from '../utils/response.js';

/*
 * Save responses are short on purpose: the full store comes from GET /seller/profile.
 * They return only what the client cannot know already: the status and slug (both can change on save)
 * or the new image URLs.
 */
const storeSummary = (profile) => ({
  _id: profile._id,
  storeName: profile.storeName,
  slug: profile.slug,
  status: profile.status,
  updatedAt: profile.updatedAt,
});
const storeImages = (profile) => ({ logo: profile.logo ?? null, banner: profile.banner ?? null });

export async function getMyStore(req, res) {
  const store = await storeService.getMyStore(req.user.id);
  return sendSuccess(res, { data: { store } });
}

export async function saveMyStore(req, res) {
  const { profile, submitted } = await storeService.saveMyStore(req.user, req.body);
  return sendSuccess(res, {
    status: submitted ? 201 : 200,
    message: submitted ? 'Store submitted for review' : 'Store details saved',
    data: { store: storeSummary(profile) },
  });
}

export async function patchMyStore(req, res) {
  const { profile, submitted } = await storeService.patchMyStore(req.user, req.body);
  return sendSuccess(res, {
    message: submitted ? 'Store resubmitted for review' : 'Store details updated',
    data: { store: storeSummary(profile) },
  });
}

export async function updateMyStoreMedia(req, res) {
  const store = await storeService.updateMyStoreMedia(req.user.id, req.files);
  return sendSuccess(res, { message: 'Store images updated', data: storeImages(store) });
}

/** PATCH: upload only the image(s) sent, and/or remove one with the `remove` field. */
export async function patchMyStoreMedia(req, res) {
  const store = await storeService.updateMyStoreMedia(req.user.id, req.files, req.body);
  const removedOnly = req.body.remove && !req.files?.logo && !req.files?.banner;
  return sendSuccess(res, { message: removedOnly ? 'Image removed' : 'Store images updated', data: storeImages(store) });
}
