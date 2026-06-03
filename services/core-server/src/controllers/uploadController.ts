import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

export const uploadController = {
  /**
   * Upload media to Cloudinary
   */
  async uploadMedia(req: AuthRequest, res: Response) {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
      const mimeType = file.mimetype || '';
      
      if (mimeType.startsWith('image/')) {
        resourceType = 'image';
      } else if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        resourceType = 'video';
      } else {
        resourceType = 'raw';
      }

      const folder = (req.body.folder as string) || "whatsapp_templates";
      const result = await uploadBufferToCloudinary(
        file.buffer, 
        resourceType, 
        folder,
        { originalFilename: file.originalname }
      );

      res.json({
        success: true,
        url: result.secure_url,
        filename: file.originalname,
        mimeType: mimeType
      });
    } catch (error: any) {
      console.error("[UPLOAD] Media upload error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to upload media", 
        error: error.message 
      });
    }
  }
};
