const cloudinary = require('cloudinary').v2;

// Configure using environment variables
// CLOUDINARY_URL=cloudinary://my_key:my_secret@my_cloud_name
// Or pass them explicitly if CLOUDINARY_URL is missing
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a buffer to Cloudinary
 * @param {Buffer} fileBuffer 
 * @param {string} resourceType 'image', 'video', 'raw' (for documents)
 * @returns {Promise<Object>}
 */
const uploadBufferToCloudinary = (fileBuffer, resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'whatsapp_templates' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

module.exports = {
  cloudinary,
  uploadBufferToCloudinary,
};
