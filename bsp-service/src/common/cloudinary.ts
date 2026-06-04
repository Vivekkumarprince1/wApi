import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

const name = config.cloudinary?.cloudName;
const key = config.cloudinary?.apiKey;
const secret = config.cloudinary?.apiSecret;

if (name && key && secret) {
  cloudinary.config({
    cloud_name: name,
    api_key: key,
    api_secret: secret,
  });
  console.log('[Cloudinary] Successfully configured connection credentials.');
} else {
  console.warn('[Cloudinary] WARNING: Credentials missing. Media uploads will fall back to mock placeholders.');
}

/**
 * Upload a buffer to Cloudinary
 * @param fileBuffer The file buffer to upload
 * @param resourceType 'image', 'video', 'raw', or 'auto'
 * @param folder The folder path in Cloudinary
 * @returns Promise<any>
 */
export const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  folder = 'whatsapp_templates',
  options: {
    originalFilename?: string;
  } = {}
): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!name || !key || !secret) {
      console.warn('[Cloudinary] Credentials not set. Gracefully resolving with mock URL.');
      return resolve({
        secure_url: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60`,
        mock: true
      });
    }

    const rawFilename = (options.originalFilename || '');
    const filenameWithoutExt = rawFilename.replace(/\.[^/.]+$/, "");

    const safeFilename = filenameWithoutExt
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const hasName = safeFilename.length > 0;
    const publicId = hasName
      ? `${Date.now()}-${safeFilename}`
      : `upload-${Date.now()}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        public_id: publicId,
      },
      (error: any, result: any) => {
        if (error) {
          console.error('[Cloudinary] Upload stream error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export { cloudinary };
