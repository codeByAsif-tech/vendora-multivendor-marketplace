import * as addressService from '../services/address.service.js';
import * as cartService from '../services/cart.service.js';
import * as orderService from '../services/order.service.js';
import { RETURN_WINDOW_DAYS } from '../services/return.service.js';
import * as wishlistService from '../services/wishlist.service.js';
import { sendSuccess } from '../utils/response.js';

// ---- Cart ----
export async function getCart(req, res) {
  return sendSuccess(res, { data: await cartService.getCart(req.user.id) });
}
export async function addCartItem(req, res) {
  return sendSuccess(res, { message: 'Added to cart', data: await cartService.addItem(req.user.id, req.body) });
}
export async function updateCartItem(req, res) {
  return sendSuccess(res, { data: await cartService.updateItem(req.user.id, req.params.itemId, req.body) });
}
export async function removeCartItem(req, res) {
  return sendSuccess(res, { message: 'Removed from cart', data: await cartService.removeItem(req.user.id, req.params.itemId) });
}
export async function clearCart(req, res) {
  return sendSuccess(res, { data: await cartService.clearCart(req.user.id) });
}
export async function applyCoupon(req, res) {
  return sendSuccess(res, { message: 'Coupon applied', data: await cartService.applyCoupon(req.user.id, req.body) });
}
export async function removeCoupon(req, res) {
  return sendSuccess(res, { message: 'Coupon removed', data: await cartService.removeCoupon(req.user.id) });
}

// ---- Wishlist ----
export async function getWishlist(req, res) {
  return sendSuccess(res, { data: await wishlistService.getWishlist(req.user.id) });
}
export async function addToWishlist(req, res) {
  return sendSuccess(res, { message: 'Saved to wishlist', data: await wishlistService.addToWishlist(req.user.id, req.body.productId) });
}
export async function removeFromWishlist(req, res) {
  return sendSuccess(res, { message: 'Removed from wishlist', data: await wishlistService.removeFromWishlist(req.user.id, req.params.productId) });
}

// ---- Addresses ----
export async function listAddresses(req, res) {
  return sendSuccess(res, { data: { addresses: await addressService.listAddresses(req.user.id) } });
}
export async function createAddress(req, res) {
  const address = await addressService.createAddress(req.user.id, req.body);
  return sendSuccess(res, { status: 201, message: 'Address saved', data: { address } });
}
export async function updateAddress(req, res) {
  const address = await addressService.updateAddress(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Address updated', data: { address } });
}
export async function setDefaultAddress(req, res) {
  const address = await addressService.setDefaultAddress(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Default address updated', data: { address } });
}
export async function deleteAddress(req, res) {
  await addressService.deleteAddress(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Address deleted' });
}

// ---- Orders ----
export async function placeOrder(req, res) {
  const { order, created } = await orderService.placeOrder(req.user, req.body);
  return sendSuccess(res, {
    status: created ? 201 : 200,
    message: created ? 'Order placed successfully' : 'Order already placed',
    data: { order },
  });
}
export async function listMyOrders(req, res) {
  return sendSuccess(res, { data: await orderService.listMyOrders(req.user.id, req.validatedQuery) });
}
export async function getMyOrder(req, res) {
  const order = await orderService.getMyOrder(req.user.id, req.params.orderNumber);
  return sendSuccess(res, { data: { order, returnWindowDays: RETURN_WINDOW_DAYS } });
}
export async function cancelMyOrder(req, res) {
  const order = await orderService.cancelMyOrder(req.user, req.params.orderNumber, req.body);
  return sendSuccess(res, { message: 'Order cancelled', data: { order } });
}
