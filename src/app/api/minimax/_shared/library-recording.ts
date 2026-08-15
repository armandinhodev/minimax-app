import type { CreateLibraryAssetDTO, CreateLibraryGenerationDTO } from '@/application/dto/LibraryDTO';
import { RecordGenerationUseCase } from '@/application/use-cases/library/RecordGeneration';
import { decodeAssetPayload, writeLocalAsset } from '@/infrastructure/assets/LocalAssetStorage';
import { SQLiteGenerationRepository } from '@/infrastructure/sqlite/SQLiteGenerationRepository';

export function recordGenerationBestEffort(input: CreateLibraryGenerationDTO): void {
  try {
    const useCase = new RecordGenerationUseCase(new SQLiteGenerationRepository());
    useCase.execute(input);
  } catch (error) {
    console.error('Failed to persist generation metadata.', error);
  }
}

export async function createLocalAudioAssetBestEffort(input: {
  payload: string;
  format: string;
  mimeType: string;
}): Promise<CreateLibraryAssetDTO> {
  try {
    const storedAsset = await writeLocalAsset({
      kind: 'audio',
      bytes: decodeAssetPayload(input.payload),
      format: input.format,
    });

    return {
      kind: 'audio',
      storageType: storedAsset.storageType,
      storageRef: storedAsset.storageRef,
      format: input.format,
      mimeType: input.mimeType,
      sizeBytes: storedAsset.sizeBytes,
    };
  } catch (error) {
    console.error('Failed to persist generated audio asset.', error);
    return {
      kind: 'audio',
      storageType: 'metadata_only',
      format: input.format,
      mimeType: input.mimeType,
    };
  }
}
