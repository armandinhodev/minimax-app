import type { LibraryGenerationDTO } from '@/application/dto/library/LibraryDTO';
import type { IGenerationRepository } from '@/domain/interfaces/library/IGenerationRepository';

export class ListLibraryGenerationsUseCase {
  constructor(private readonly repository: IGenerationRepository) {}

  execute(limit = 50): LibraryGenerationDTO[] {
    return this.repository.listRecentGenerations(limit);
  }
}
