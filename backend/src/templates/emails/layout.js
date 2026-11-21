import { env } from '../../config/env.js';
import { escapeHtml } from '../../utils/text.js';

/**
 * Builds a simple, email-client-safe HTML message plus a plain-text version.
 * `paragraphs` are plain strings (escaped here). `note` is an optional highlighted box, e.g. a reason.
 */
export function buildEmail({ subject, greeting, paragraphs = [], note, cta }) {
  const p = (text) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155">${escapeHtml(text)}</p>`;

  const noteHtml = note
    ? `<div style="margin:0 0 16px;padding:12px 16px;border-radius:8px;background:#fff8f0;border-left:4px solid #92140c">
         <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase">${escapeHtml(note.label)}</p>
         <p style="margin:0;font-size:14px;color:#0f172a">${escapeHtml(note.text)}</p>
       </div>`
    : '';

  const ctaHtml = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(env.appUrl + cta.path)}"
         style="display:inline-block;padding:12px 22px;border-radius:8px;background:#92140c;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none">${escapeHtml(cta.label)}</a></p>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:20px;font-weight:800;color:#0f172a">${escapeHtml(env.APP_NAME)}</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">${escapeHtml(greeting)}</p>
          ${paragraphs.map(p).join('\n')}
          ${noteHtml}
          ${ctaHtml}
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">The ${escapeHtml(env.APP_NAME)} team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    greeting,
    '',
    ...paragraphs,
    note ? `\n${note.label}: ${note.text}` : '',
    cta ? `\n${cta.label}: ${env.appUrl}${cta.path}` : '',
    '',
    `The ${env.APP_NAME} team`,
  ].join('\n');

  return { subject, html, text };
}
