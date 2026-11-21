import { Address } from '../models/address.model.js';
import { ApiError } from '../utils/ApiError.js';
import { MAX_ADDRESSES } from '../utils/constants.js';

export function listAddresses(userId) {
  return Address.find({ user: userId }).sort({ isDefault: -1, updatedAt: -1 });
}

async function findOwned(userId, id) {
  const address = await Address.findOne({ _id: id, user: userId });
  if (!address) throw ApiError.notFound('Address not found');
  return address;
}

async function unsetOtherDefaults(userId, keepId) {
  await Address.updateMany({ user: userId, _id: { $ne: keepId } }, { isDefault: false });
}

export async function createAddress(userId, input) {
  const count = await Address.countDocuments({ user: userId });
  if (count >= MAX_ADDRESSES) throw ApiError.badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);

  // The first address is always the default.
  const address = await Address.create({ ...input, user: userId, isDefault: count === 0 || Boolean(input.isDefault) });
  if (address.isDefault) await unsetOtherDefaults(userId, address._id);
  return address;
}

export async function updateAddress(userId, id, input) {
  const address = await findOwned(userId, id);
  const { isDefault, ...fields } = input;
  address.set(fields);
  if (isDefault) address.isDefault = true;
  await address.save();
  if (address.isDefault) await unsetOtherDefaults(userId, address._id);
  return address;
}

export async function setDefaultAddress(userId, id) {
  const address = await findOwned(userId, id);
  address.isDefault = true;
  await address.save();
  await unsetOtherDefaults(userId, address._id);
  return address;
}

/** Deleting the default makes the most recently updated remaining address the default. */
export async function deleteAddress(userId, id) {
  const address = await findOwned(userId, id);
  await address.deleteOne();
  if (address.isDefault) {
    const next = await Address.findOne({ user: userId }).sort({ updatedAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
}
