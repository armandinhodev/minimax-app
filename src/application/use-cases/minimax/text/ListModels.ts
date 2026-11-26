/**
 * ListModels use case — read the model catalogue exposed by the account.
 */

import type { TextModelDTO } from '@/application/dto/minimax/text/TextDTO';
import type { ITextClient } from '@/domain/interfaces/minimax/text/ITextClient';

export class ListModelsUseCase {
  constructor(private readonly textClient: ITextClient) {}

  async execute(): Promise<TextModelDTO[]> {
    return this.textClient.listModels();
  }
}
