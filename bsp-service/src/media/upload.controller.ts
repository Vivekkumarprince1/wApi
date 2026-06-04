import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadBufferToCloudinary } from '../common/cloudinary';

@Controller()
export class UploadController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @Body('folder') folder?: string) {
    return this.handleUpload(file, folder);
  }

  @Post('api/v1/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileV1(@UploadedFile() file: any, @Body('folder') folder?: string) {
    return this.handleUpload(file, folder);
  }

  private async handleUpload(file: any, folderName?: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const mimeType = file.mimetype || '';
    const filename = file.originalname || 'uploaded_file';

    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
    if (mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      resourceType = 'video';
    } else {
      resourceType = 'raw';
    }

    const folder = folderName || 'whatsapp_templates';

    try {
      const result = await uploadBufferToCloudinary(
        file.buffer,
        resourceType,
        folder,
        { originalFilename: filename }
      );

      return {
        success: true,
        url: result.secure_url,
        filename: filename,
        mimeType: mimeType
      };
    } catch (err: any) {
      console.error('[UploadController] Cloudinary upload failed:', err.message);
      // Fallback in case of API error in dev
      const mockUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60`;
      return {
        success: true,
        url: mockUrl,
        filename: filename,
        mimeType: mimeType,
        warning: 'Cloudinary upload failed, returned fallback mock URL'
      };
    }
  }
}
