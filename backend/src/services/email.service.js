import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** In tests, sent emails are collected here instead of being delivered. */
export const testOutbox = [];

let transporter = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Sends one email. `message` = { to, subject, html, text } */
export async function sendEmail(message) {
  if (env.isTest) {
    testOutbox.push(message);
    return;
  }

  const smtp = getTransporter();
  if (!smtp) {
    logger.info({ to: message.to, subject: message.subject }, 'Email not sent (SMTP_HOST not configured)');
    return;
  }

  await smtp.sendMail({ from: env.MAIL_FROM, ...message });
}

/**
 * Fire-and-forget: an email problem must never fail the user's request.
 * Failures are logged. (A retry queue can be added in Phase 10.)
 */
export function queueEmail(to, template) {
  if (!to || !template) return;
  sendEmail({ to, ...template }).catch((err) => {
    logger.error({ err, to, subject: template.subject }, 'Email delivery failed');
  });
}
