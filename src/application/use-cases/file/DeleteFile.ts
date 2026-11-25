/**
 * DeleteFile use case — delete a MiniMax file by file_id.
 */

import type { IMiniMaxFileClient } from '@/domain/interfaces/IMiniMaxFileClient';
import { DeleteFileSchema } from '@/lib/validators';
import type { FileDeletePurpose } from '@/application/dto/FileDTO';

export class DeleteFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeleteFileValidationError';
  }
}

export class DeleteFileUseCase {
  constructor(private readonly fileClient: IMiniMaxFileClient) {}

  /**
   * Execute delete file.
   *
   * @throws DeleteFileValidationError — invalid file_id or purpose
   * @throws Error                      — MiniMax API errors
   */
  async execute(request: {
    fileId: string;
    purpose: FileDeletePurpose;
  }): Promise<void> {
    const parsed = DeleteFileSchema.safeParse(request);
    if (!parsed.success) {
      throw new DeleteFileValidationError(
        parsed.error.issues.map((e: { message: string }) => e.message).join('; ')
      );
    }

    await this.fileClient.deleteFile(parsed.data.fileId, parsed.data.purpose);
  }
}
