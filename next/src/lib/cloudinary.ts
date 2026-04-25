import { v2 as cloudinary } from 'cloudinary';

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
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
