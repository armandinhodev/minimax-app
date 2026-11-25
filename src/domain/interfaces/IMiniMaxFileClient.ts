/**
 * Port interface for MiniMax File API operations.
 * Implementations are server-only and must never be bundled for the browser.
 *
 * MiniMax documents a different purpose set per endpoint, so each operation
 * uses the purpose type documented for that endpoint:
 * https://platform.minimax.io/docs/api-reference/file-management-upload
 */
import type {
  FileDeletePurpose,
  FileListPurpose,
  FileUploadPurpose,
  MiniMaxFilePurpose,
} from '@/application/dto/FileDTO';

export interface IMiniMaxFileClient {
  uploadFile(fileContent: Buffer, fileName: string, purpose: FileUploadPurpose): Promise<FileMetadata>;
  listFiles(purpose?: FileListPurpose): Promise<FileMetadata[]>;
  getFile(fileId: string): Promise<FileMetadata & { downloadUrl: string }>;
  deleteFile(fileId: string, purpose: FileDeletePurpose): Promise<void>;
  retrieveContent(fileId: string): Promise<Uint8Array>;
}

export type FilePurpose = MiniMaxFilePurpose;

export interface FileMetadata {
  fileId: string;
  fileName: string;
  purpose: MiniMaxFilePurpose;
  size: number;
  createdAt: number; // Unix timestamp ms
}
