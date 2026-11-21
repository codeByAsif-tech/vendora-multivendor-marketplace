export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const MAX_IMAGE_MB = 5

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Quick client-side check (the server re-checks the real file content). Returns an error message or null. */
export function validateImageFile(file) {
  if (!ALLOWED.has(file.type)) return `"${file.name}" is not a JPG, PNG or WebP image`
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `"${file.name}" is larger than ${MAX_IMAGE_MB} MB`
  return null
}
