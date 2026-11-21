import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import cloudinaryPackage from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Image storage with two drivers:
 *  - cloudinary: production (free tier)
 *  - local:      development, files under UPLOAD_DIR served at /uploads
 * Both return { url, publicId }. publicId always starts with the folder, which is how
 * ownership of an image is checked (e.g. a seller may only use images in their own folder).
 */
const cloudinary = cloudinaryPackage.v2;
const useCloudinary = env.UPLOAD_DRIVER === 'cloudinary';

if (useCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Startup check: with the Cloudinary driver, makes one signed API call so wrong keys are
 * reported in the log when the server starts, not on a seller's first upload. Never stops the server.
 */
export async function verifyStorage() {
  if (!useCloudinary) {
    logger.info({ uploadRoot: env.uploadRoot }, 'Images are stored locally');
    return;
  }
  try {
    await cloudinary.api.ping();
    logger.info({ cloud: env.CLOUDINARY_CLOUD_NAME }, 'Cloudinary connected');
  } catch (err) {
    logger.error(
      { cloudinaryStatus: err?.error?.http_code ?? err?.http_code, cloudinaryMessage: err?.error?.message ?? err?.message },
      'Cloudinary credentials are not working: image uploads will fail. Check the CLOUDINARY_* values in .env.',
    );
  }
}

export const assetFolders = {
  product: (sellerId) => `marketplace/products/${sellerId}`,
  store: (sellerId) => `marketplace/stores/${sellerId}`,
  category: () => 'marketplace/categories',
};

function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', overwrite: false },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

/** `file` is a multer file that passed verifyImages (has buffer + detectedType). */
export async function uploadImage(file, folder) {
  if (useCloudinary) {
    try {
      const result = await uploadToCloudinary(file.buffer, folder);
      return { url: result.secure_url, publicId: result.public_id };
    } catch (err) {
      // Cloudinary rejects with a plain object ({ message, http_code }), not an Error.
      const status = err?.http_code;
      const hint =
        status === 401
          ? 'Cloudinary rejected the credentials: check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env (they must all be from the same Cloudinary account).'
          : 'Cloudinary upload failed.';
      logger.error({ cloudinaryStatus: status, cloudinaryMessage: err?.message, folder }, hint);
      throw new ApiError(502, 'Image upload is not working right now. Please try again later.', undefined, 'UPLOAD_FAILED');
    }
  }

  const publicId = `${folder}/${randomUUID()}.${file.detectedType.ext}`;
  const target = path.join(env.uploadRoot, publicId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.buffer);
  return { url: `/uploads/${publicId}`, publicId };
}

export async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    if (useCloudinary) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      return;
    }
    const target = path.resolve(env.uploadRoot, publicId);
    if (!target.startsWith(env.uploadRoot + path.sep)) return; // path traversal guard
    await fs.rm(target, { force: true });
  } catch (err) {
    logger.warn({ err, publicId }, 'Could not delete image');
  }
}

/** Fire-and-forget cleanup of replaced/removed images. */
export function deleteImagesLater(publicIds) {
  for (const publicId of publicIds.filter(Boolean)) deleteImage(publicId);
}

/** True if the image was uploaded by us into `folder` (blocks hot-linking other sellers' or external images). */
export function isOwnedAsset(image, folder) {
  if (!image?.publicId || !image?.url) return false;
  if (image.publicId.includes('..') || !image.publicId.startsWith(`${folder}/`)) return false;

  if (useCloudinary) {
    const prefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
    return image.url.startsWith(prefix) && image.url.includes(image.publicId);
  }
  return image.url === `/uploads/${image.publicId}`;
}
