import type { CreateLibraryGenerationDTO, LibraryGenerationDTO, LibrarySummaryDTO } from '@/application/dto/library/LibraryDTO';

export interface IGenerationRepository {
  createGeneration(input: CreateLibraryGenerationDTO): LibraryGenerationDTO;
  getDashboardSummary(limit: number): LibrarySummaryDTO;
  listRecentGenerations(limit: number): LibraryGenerationDTO[];
  deleteGeneration(id: string): boolean;
}
