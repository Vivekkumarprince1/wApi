import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaStorageError, uploadBufferToCloudinary } from '../../../common/cloudinary';
import { WorkspaceAuthGuard } from '../../../common/workspace-auth.guard';
import { MAX_MEDIA_BYTES, validateMediaInput } from './media-policy';

const uploadInterceptor = FileInterceptor('file', { limits: { fileSize: MAX_MEDIA_BYTES } });

@Controller()
@UseGuards(WorkspaceAuthGuard)
export class UploadController {
  @Post('upload')
  @UseInterceptors(uploadInterceptor)
  async uploadFile(@UploadedFile() file: any, @Body('folder') folder?: string) {
    return this.handleUpload(file, folder);
  }

  @Post('api/v1/upload')
  @UseInterceptors(uploadInterceptor)
  async uploadFileV1(@UploadedFile() file: any, @Body('folder') folder?: string) {
    return this.handleUpload(file, folder);
  }

  // customer-portal posts media uploads to /api/v1/upload/media
  @Post('api/v1/upload/media')
  @UseInterceptors(uploadInterceptor)
  async uploadMedia(@UploadedFile() file: any, @Body('folder') folder?: string) {
    return this.handleUpload(file, folder);
  }

  private async handleUpload(file: any, folderName?: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const mimeType = file.mimetype || '';
    const filename = file.originalname || 'uploaded_file';
    const mediaValidation = validateMediaInput(file);
    if (!mediaValidation.valid && mediaValidation.status === 400) {
      throw new BadRequestException({ success: false, error: { code: mediaValidation.code, message: 'Uploaded media is empty or invalid' } });
    }
    if (!mediaValidation.valid) {
      throw new HttpException(
        { success: false, error: { code: mediaValidation.code, message: 'The uploaded media type is not supported' } },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
    if (mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      resourceType = 'video';
    } else {
      resourceType = 'raw';
    }

    const requestedFolder = folderName || 'whatsapp_templates';
    const folder = requestedFolder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/\.{2,}/g, '').slice(0, 120) || 'whatsapp_templates';

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
        publicId: result.public_id,
        resourceType: result.resource_type,
        bytes: result.bytes,
        filename: filename,
        mimeType: mimeType
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const code = err instanceof MediaStorageError ? err.code : 'MEDIA_STORAGE_UNAVAILABLE';
      const message = code === 'MEDIA_STORAGE_NOT_CONFIGURED'
        ? 'Media storage is not configured'
        : 'Media storage is temporarily unavailable';
      throw new HttpException(
        { success: false, error: { code, message } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
