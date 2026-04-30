import { v2 as cloudinary } from 'cloudinary';
import { config } from './config';

if (config.cloudinaryCloudName) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  });
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
  folder: string = 'whatsapp_templates',
  options: {
    originalFilename?: string;
  } = {}
): Promise<any> => {
  return new Promise((resolve, reject) => {
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
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export { cloudinary };
