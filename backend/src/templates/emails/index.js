import { env } from '../../config/env.js';
import { buildEmail } from './layout.js';

const app = () => env.APP_NAME;
const hi = (name) => `Hi ${name},`;

export const emailTemplates = {
  // ---- Accounts ----
  welcomeCustomer: ({ name, verifyPath }) =>
    buildEmail({
      subject: `Welcome to ${app()}: please verify your email`,
      greeting: hi(name),
      paragraphs: [
        `Your ${app()} account is ready. Discover products from verified sellers, save favourites and check out in one go.`,
        'Please confirm this is your email address. The link works for 24 hours.',
      ],
      cta: verifyPath ? { label: 'Verify my email', path: verifyPath } : { label: 'Start shopping', path: '/' },
    }),

  welcomeSeller: ({ name, verifyPath }) =>
    buildEmail({
      subject: `Welcome to ${app()} Seller Hub: please verify your email`,
      greeting: hi(name),
      paragraphs: [
        'Your seller account has been created.',
        'First, confirm this is your email address (the link works for 24 hours). Then add your store details and documents. Our team reviews every store before it goes live.',
      ],
      cta: verifyPath ? { label: 'Verify my email', path: verifyPath } : { label: 'Set up your store', path: '/seller/settings' },
    }),

  verifyEmail: ({ name, path }) =>
    buildEmail({
      subject: `Verify your email for ${app()}`,
      greeting: hi(name),
      paragraphs: ['Please confirm this is your email address. The link works for 24 hours.', 'If you did not ask for this, you can ignore this email.'],
      cta: { label: 'Verify my email', path },
    }),

  passwordReset: ({ name, path, minutes }) =>
    buildEmail({
      subject: `Reset your ${app()} password`,
      greeting: hi(name),
      paragraphs: [
        `Someone (hopefully you) asked to reset the password of your ${app()} account. The link works for ${minutes} minutes and only once.`,
        'If you did not ask for this, ignore this email: your password stays the same.',
      ],
      cta: { label: 'Choose a new password', path },
    }),

  passwordChanged: ({ name }) =>
    buildEmail({
      subject: `Your ${app()} password was changed`,
      greeting: hi(name),
      paragraphs: [
        'Your password was just changed and you were signed out on all devices.',
        'If this was not you, reset your password right away and contact support.',
      ],
      cta: { label: 'Reset password', path: '/forgot-password' },
    }),

  accountBlocked: ({ name, reason }) =>
    buildEmail({
      subject: `Your ${app()} account has been blocked`,
      greeting: hi(name),
      paragraphs: ['Your account has been blocked and you can no longer sign in.', 'If you think this is a mistake, please contact support.'],
      note: reason ? { label: 'Reason', text: reason } : undefined,
    }),

  accountReactivated: ({ name }) =>
    buildEmail({
      subject: `Your ${app()} account is active again`,
      greeting: hi(name),
      paragraphs: ['Good news: your account has been reactivated. You can sign in again.'],
      cta: { label: 'Sign in', path: '/login' },
    }),

  // ---- Seller onboarding ----
  sellerApplicationReceived: ({ name, storeName }) =>
    buildEmail({
      subject: `We received your application for "${storeName}"`,
      greeting: hi(name),
      paragraphs: [
        `Thanks for submitting "${storeName}". Our team will review your details, usually within 1–2 business days.`,
        'We will email you as soon as a decision is made.',
      ],
      cta: { label: 'View application status', path: '/seller/settings' },
    }),

  sellerApproved: ({ name, storeName }) =>
    buildEmail({
      subject: `"${storeName}" is approved. Start selling!`,
      greeting: hi(name),
      paragraphs: [`Congratulations! Your store "${storeName}" has been approved.`, 'You can now add products. Each product is reviewed before it appears in the storefront.'],
      cta: { label: 'Add your first product', path: '/seller/products/create' },
    }),

  sellerRejected: ({ name, storeName, reason }) =>
    buildEmail({
      subject: `Update on your application for "${storeName}"`,
      greeting: hi(name),
      paragraphs: [`Unfortunately we could not approve "${storeName}" yet.`, 'Please update your store details and resubmit.'],
      note: reason ? { label: 'Reason', text: reason } : undefined,
      cta: { label: 'Update store details', path: '/seller/settings' },
    }),

  sellerSuspended: ({ name, storeName, reason }) =>
    buildEmail({
      subject: `"${storeName}" has been suspended`,
      greeting: hi(name),
      paragraphs: [`Your store "${storeName}" has been suspended. Your products are hidden from the storefront until it is reinstated.`],
      note: reason ? { label: 'Reason', text: reason } : undefined,
    }),

  sellerReinstated: ({ name, storeName }) =>
    buildEmail({
      subject: `"${storeName}" has been reinstated`,
      greeting: hi(name),
      paragraphs: [`Your store "${storeName}" is active again and your approved products are visible to customers.`],
      cta: { label: 'Open Seller Hub', path: '/seller/dashboard' },
    }),

  // ---- Products ----
  productApproved: ({ name, productName }) =>
    buildEmail({
      subject: `Product approved: ${productName}`,
      greeting: hi(name),
      paragraphs: [`"${productName}" has been approved and is now visible in the storefront (if it is set to active).`],
      cta: { label: 'View products', path: '/seller/products' },
    }),

  // ---- Orders ----
  orderPlaced: ({ name, orderNumber, total, paymentMethod }) =>
    buildEmail({
      subject: `Order ${orderNumber} placed`,
      greeting: hi(name),
      paragraphs: [
        `Thank you for your order! Order ${orderNumber} for ${total} has been placed.`,
        paymentMethod === 'cod'
          ? 'You will pay in cash when it is delivered.'
          : 'We are verifying your payment. Your order is confirmed as soon as the payment is verified.',
      ],
      cta: { label: 'Track your order', path: `/my-orders/${orderNumber}` },
    }),

  newOrderForSeller: ({ name, orderNumber, itemCount, total }) =>
    buildEmail({
      subject: `New order ${orderNumber}`,
      greeting: hi(name),
      paragraphs: [`You have a new order (${orderNumber}) with ${itemCount} item(s) worth ${total}.`],
      cta: { label: 'View order', path: '/seller/orders' },
    }),

  orderStatusUpdate: ({ name, orderNumber, statusLabel, note }) =>
    buildEmail({
      subject: `Order ${orderNumber}: ${statusLabel}`,
      greeting: hi(name),
      paragraphs: [`Your shipment ${orderNumber} is now: ${statusLabel}.`],
      note: note ? { label: 'Details', text: note } : undefined,
      cta: { label: 'View order', path: '/my-orders' },
    }),

  paymentVerified: ({ name, orderNumber, amount }) =>
    buildEmail({
      subject: `Payment received for order ${orderNumber}`,
      greeting: hi(name),
      paragraphs: [`We have verified your payment of ${amount}. Your order ${orderNumber} is confirmed and the seller will start packing it.`],
      cta: { label: 'Track your order', path: `/my-orders/${orderNumber}` },
    }),

  paymentRejected: ({ name, orderNumber, reason }) =>
    buildEmail({
      subject: `Action needed: payment for order ${orderNumber}`,
      greeting: hi(name),
      paragraphs: [
        `We could not verify the payment reference you entered for order ${orderNumber}.`,
        'Please check the UTR / transaction ID in your payment app and submit it again from your order page.',
      ],
      note: reason ? { label: 'Reason', text: reason } : undefined,
      cta: { label: 'Update payment details', path: `/my-orders/${orderNumber}` },
    }),

  refundRecorded: ({ name, orderNumber, amount, reference }) =>
    buildEmail({
      subject: `Refund of ${amount} for order ${orderNumber}`,
      greeting: hi(name),
      paragraphs: [`We have refunded ${amount} for the cancelled or returned items of order ${orderNumber}. It can take a few days to show in your account.`],
      note: reference ? { label: 'Refund reference', text: reference } : undefined,
      cta: { label: 'View order', path: `/my-orders/${orderNumber}` },
    }),

  // ---- Seller earnings ----
  payoutSent: ({ name, amount, reference, last4 }) =>
    buildEmail({
      subject: `Payout of ${amount} sent`,
      greeting: hi(name),
      paragraphs: [
        `We have sent ${amount} of your earnings${last4 ? ` to your bank account ending ${last4}` : ''}. It can take up to a day to show in your account.`,
      ],
      note: { label: 'Payout reference', text: reference },
      cta: { label: 'View earnings', path: '/seller/earnings' },
    }),

  orderCancelledForSeller: ({ name, orderNumber, reason }) =>
    buildEmail({
      subject: `Order ${orderNumber} was cancelled`,
      greeting: hi(name),
      paragraphs: [`Order ${orderNumber} was cancelled by the customer. The stock has been returned to your inventory.`],
      note: reason ? { label: 'Reason', text: reason } : undefined,
      cta: { label: 'View orders', path: '/seller/orders' },
    }),

  productRejected: ({ name, productName, reason }) =>
    buildEmail({
      subject: `Product needs changes: ${productName}`,
      greeting: hi(name),
      paragraphs: [`"${productName}" was not approved. Edit the product and save it to send it for review again.`],
      note: reason ? { label: 'Reason', text: reason } : undefined,
      cta: { label: 'Edit products', path: '/seller/products' },
    }),
};
