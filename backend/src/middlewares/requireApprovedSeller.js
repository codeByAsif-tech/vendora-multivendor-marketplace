import { SellerProfile } from '../models/sellerProfile.model.js';
import { ApiError } from '../utils/ApiError.js';
import { SELLER_STATUS } from '../utils/constants.js';

const MESSAGES = {
  [SELLER_STATUS.PENDING]: 'Your store is awaiting approval. You can add products once it is approved.',
  [SELLER_STATUS.REJECTED]: 'Your store application was rejected. Update your store details and resubmit.',
  [SELLER_STATUS.SUSPENDED]: 'Your store is suspended. Contact support for help.',
};

/**
 * Use after authenticate + authorize('seller').
 * Only sellers with an approved store may change catalog data. Sets req.store = { _id, storeName, slug, status }.
 */
export async function requireApprovedSeller(req, _res, next) {
  const store = await SellerProfile.findOne({ user: req.user.id }).select('storeName slug status').lean();

  if (!store) {
    throw ApiError.forbidden('Set up your store profile first.', 'STORE_PROFILE_REQUIRED');
  }
  if (store.status !== SELLER_STATUS.APPROVED) {
    throw ApiError.forbidden(MESSAGES[store.status], `STORE_${store.status.toUpperCase()}`);
  }

  req.store = store;
  next();
}
