import type { LibrarySummaryDTO } from '@/application/dto/library/LibraryDTO';
import type { IGenerationRepository } from '@/domain/interfaces/library/IGenerationRepository';

export class GetLibraryDashboardUseCase {
  constructor(private readonly repository: IGenerationRepository) {}

  execute(limit = 6): LibrarySummaryDTO {
    return this.repository.getDashboardSummary(limit);
  }
}
