/**
 * POST /api/minimax/asr/transcriptions
 * Transcribe an audio file with MiniMax ASR (POST /v1/speech_to_text).
 * Accepts multipart/form-data: file (File), model, response_format,
 * timestamp_level, language.
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 *
 * Returns the JSON transcript for `json` / `verbose_json`, or the raw
 * subtitles for `srt` / `vtt`.
 */

import { NextResponse } from 'next/server';

import { getSubtitleContentType } from '@/application/dto/minimax/asr/AsrDTO';
import { TranscribeAudioUseCase } from '@/application/use-cases/minimax/asr/TranscribeAudio';
import { AsrClient } from '@/infrastructure/minimax/asr/AsrClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createMiniMaxRouteErrorResponse } from '../../_shared/route-error';

/** Reads the optional text fields of the multipart body. */
export function readAsrFormFields(formData: FormData): {
  model?: string;
  responseFormat?: string;
  timestampLevel?: string;
  language?: string;
} {
  const read = (key: string): string | undefined => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : undefined;
  };

  return {
    model: read('model'),
    responseFormat: read('response_format'),
    timestampLevel: read('timestamp_level'),
    language: read('language'),
  };
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file (File) is required' }, { status: 400 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 });
  }

  const fields = readAsrFormFields(formData);

  try {
    const useCase = new TranscribeAudioUseCase(new AsrClient());
    const result = await useCase.execute({
      fileContent: fileBuffer,
      fileName: file.name,
      ...fields,
    });

    if ('format' in result) {
      return new Response(result.content, {
        status: 200,
        headers: { 'Content-Type': getSubtitleContentType(result.format) },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'TranscribeAudioValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/asr/transcriptions',
      method: 'POST',
      statusCode: 500,
    });
  }
}
