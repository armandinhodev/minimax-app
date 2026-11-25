/**
 * UploadFile use case — generic file upload to MiniMax.
 */

import type { IFileClient } from '@/domain/interfaces/minimax/files/IFileClient';
import type { FileMetadataDTO, FileUploadPurpose } from '@/application/dto/minimax/files/FileDTO';
import { UploadFileSchema } from '@/application/dto/minimax/files/FileDTO';

export class UploadFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadFileValidationError';
  }
}

export class UploadFileUseCase {
  constructor(private readonly fileClient: IFileClient) {}

  /**
   * Execute file upload.
   *
   * @throws UploadFileValidationError — invalid purpose
   * @throws Error                      — MiniMax API errors
   */
  async execute(request: {
    fileBuffer: Buffer;
    fileName: string;
    purpose: FileUploadPurpose;
  }): Promise<FileMetadataDTO> {
    const parsed = UploadFileSchema.safeParse({ purpose: request.purpose });
    if (!parsed.success) {
      throw new UploadFileValidationError(
        parsed.error.issues.map((e: { message: string }) => e.message).join('; ')
      );
    }

    const metadata = await this.fileClient.uploadFile(
      request.fileBuffer,
      request.fileName,
      request.purpose
    );

    return {
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      purpose: metadata.purpose,
      size: metadata.size,
      createdAt: metadata.createdAt,
    };
  }
}
