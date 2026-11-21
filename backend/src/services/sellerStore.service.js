import { SellerProfile } from '../models/sellerProfile.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import { SELLER_STATUS } from '../utils/constants.js';
import { encrypt } from '../utils/crypto.js';
import { slugify } from '../utils/text.js';
import { queueEmail } from './email.service.js';
import { assetFolders, deleteImagesLater, uploadImage } from './storage.service.js';

export function getMyStore(userId) {
  return SellerProfile.findOne({ user: userId });
}

/**
 * Creates the store profile (first submission) or updates it.
 * - New profile → status "pending" (application submitted)
 * - Rejected profile updated → back to "pending" (resubmitted)
 * - Approved / suspended profiles keep their status
 *
 * @param user { id, name, email } from req.user
 */
export async function saveMyStore(user, input) {
  const slug = slugify(input.storeName);
  if (slug.length < 3) throw ApiError.field('storeName', 'Store name must contain letters or numbers');

  const taken = await SellerProfile.exists({ slug, user: { $ne: user.id } });
  if (taken) throw ApiError.field('storeName', 'This store name is already taken');

  const existing = await SellerProfile.findOne({ user: user.id });
  const { bank, gstin, ...details } = input;
  const accountNumber = bank.accountNumber || null;

  if (!existing && !accountNumber) {
    throw ApiError.field('bank.accountNumber', 'Account number is required');
  }

  const profile = existing ?? new SellerProfile({ user: user.id, status: SELLER_STATUS.PENDING });

  profile.set({
    ...details,
    slug,
    gstin: gstin || undefined,
    bank: {
      accountHolderName: bank.accountHolderName,
      bankName: bank.bankName,
      ifsc: bank.ifsc,
      accountNumberLast4: accountNumber ? accountNumber.slice(-4) : existing.bank.accountNumberLast4,
    },
  });
  if (accountNumber) profile.bankAccountNumberEncrypted = encrypt(accountNumber);

  let submitted = false;
  if (!existing) {
    profile.submittedAt = new Date();
    profile.statusHistory.push({ status: SELLER_STATUS.PENDING, reason: 'Application submitted', changedBy: user.id });
    submitted = true;
  } else if (existing.status === SELLER_STATUS.REJECTED) {
    profile.status = SELLER_STATUS.PENDING;
    profile.statusReason = undefined;
    profile.submittedAt = new Date();
    profile.statusHistory.push({ status: SELLER_STATUS.PENDING, reason: 'Application resubmitted', changedBy: user.id });
    submitted = true;
  }

  await profile.save();

  if (submitted) {
    queueEmail(user.email, emailTemplates.sellerApplicationReceived({ name: user.name, storeName: profile.storeName }));
  }

  return { profile, submitted };
}

/**
 * PATCH: changes only the fields sent. Everything else is taken from the saved profile, then the
 * same rules as a full save apply (unique store name, rejected store → resubmitted, ...).
 * The bank account number is kept unless a new one is sent.
 */
export async function patchMyStore(user, patch) {
  const existing = await SellerProfile.findOne({ user: user.id }).lean();
  if (!existing) {
    throw new ApiError(404, 'Create your store first, then you can change single fields', undefined, 'STORE_NOT_FOUND');
  }

  const { line1, line2, city, state, postalCode, country } = existing.pickupAddress ?? {};
  const { accountHolderName, bankName, ifsc } = existing.bank ?? {};

  return saveMyStore(user, {
    storeName: patch.storeName ?? existing.storeName,
    description: patch.description ?? existing.description ?? '',
    businessType: patch.businessType ?? existing.businessType,
    gstin: 'gstin' in patch ? patch.gstin : (existing.gstin ?? ''),
    pan: patch.pan ?? existing.pan,
    contactEmail: patch.contactEmail ?? existing.contactEmail,
    contactPhone: patch.contactPhone ?? existing.contactPhone,
    pickupAddress: { line1, line2: line2 ?? '', city, state, postalCode, country, ...patch.pickupAddress },
    bank: { accountHolderName, bankName, ifsc, ...patch.bank, accountNumber: patch.bank?.accountNumber ?? '' },
  });
}

/**
 * Uploads a new logo and/or banner (only the ones sent are changed), and/or removes one.
 * `files` = { logo?: [file], banner?: [file] } from multer; `remove` = 'logo' | 'banner' | 'both'.
 */
export async function updateMyStoreMedia(userId, files = {}, { remove } = {}) {
  const profile = await SellerProfile.findOne({ user: userId });
  if (!profile) throw ApiError.badRequest('Save your store details before uploading images');

  const logo = files.logo?.[0];
  const banner = files.banner?.[0];
  const removeLogo = remove === 'logo' || remove === 'both';
  const removeBanner = remove === 'banner' || remove === 'both';
  if (!logo && !banner && !remove) throw ApiError.badRequest('Choose a logo or banner image to upload');
  if ((logo && removeLogo) || (banner && removeBanner)) {
    throw ApiError.field('remove', 'You cannot upload and remove the same image at once');
  }

  const folder = assetFolders.store(userId);
  const replaced = [];

  if (removeLogo && profile.logo) {
    replaced.push(profile.logo.publicId);
    profile.logo = undefined;
  }
  if (removeBanner && profile.banner) {
    replaced.push(profile.banner.publicId);
    profile.banner = undefined;
  }

  if (logo) {
    replaced.push(profile.logo?.publicId);
    profile.logo = await uploadImage(logo, folder);
  }
  if (banner) {
    replaced.push(profile.banner?.publicId);
    profile.banner = await uploadImage(banner, folder);
  }

  await profile.save();
  deleteImagesLater(replaced);
  return profile;
}
