/**
 * POST /api/minimax/asr/transcriptions/stream
 * Streams a transcription with MiniMax ASR (POST /v1/speech_to_text with
 * stream=true). The upstream SSE events are forwarded verbatim.
 * Accepts multipart/form-data: file (File), model, language.
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 *
 * Only `json` is allowed: the diarization formats (verbose_json, srt, vtt)
 * cannot be combined with streaming.
 */

import { NextResponse } from 'next/server';

import { TranscribeAudioUseCase } from '@/application/use-cases/minimax/asr/TranscribeAudio';
import { AsrClient } from '@/infrastructure/minimax/asr/AsrClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createMiniMaxRouteErrorResponse } from '../../../_shared/route-error';
import { readAsrFormFields } from '../route';

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
    const stream = await useCase.executeStream({
      fileContent: fileBuffer,
      fileName: file.name,
      ...fields,
      responseFormat: 'json',
    });

    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TranscribeAudioValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/asr/transcriptions/stream',
      method: 'POST',
      statusCode: 500,
    });
  }
}
