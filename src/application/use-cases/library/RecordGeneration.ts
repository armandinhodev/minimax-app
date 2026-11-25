import type { CreateLibraryGenerationDTO, LibraryGenerationDTO } from '@/application/dto/library/LibraryDTO';
import type { IGenerationRepository } from '@/domain/interfaces/library/IGenerationRepository';

export class RecordGenerationUseCase {
  constructor(private readonly repository: IGenerationRepository) {}

  execute(input: CreateLibraryGenerationDTO): LibraryGenerationDTO {
    return this.repository.createGeneration(input);
  }
}
