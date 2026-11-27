'use client';

import { type ChangeEvent, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { Field, Spec, SpecList } from '@/components/ui/spec';
import { ConsoleBand } from '@/components/ui/console-band';

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MIN_AUDIO_DURATION_SECONDS = 6;
const MAX_AUDIO_DURATION_SECONDS = 6 * 60;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
]);
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']);

interface CoverPreprocessResult {
  coverPreprocessId?: string;
  coverFeatureId: string;
  formattedLyrics: string;
  structureResult: string;
  audioDurationSeconds: number;
  traceId?: string;
  metadata: {
    status?: number;
    message?: string;
  };
}

interface SelectedAudioFile {
  name: string;
  size: number;
  base64: string;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  return lastDot >= 0 ? name.toLowerCase().slice(lastDot) : '';
}

function validateAudioFile(file: File): string | null {
  const extension = getFileExtension(file.name);
  if (file.size > MAX_AUDIO_BYTES) {
    return `Reference audio must be at most 50 MB. Selected file is ${formatBytes(file.size)}.`;
  }
  if (file.type && !ALLOWED_AUDIO_MIME_TYPES.has(file.type)) {
    return 'Reference audio must be a common audio format such as MP3, WAV, FLAC, M4A, AAC, or OGG.';
  }
  if (!file.type && !ALLOWED_AUDIO_EXTENSIONS.has(extension)) {
    return 'Reference audio must use a supported extension: MP3, WAV, FLAC, M4A, AAC, or OGG.';
  }
  return null;
}

function validateAudioDuration(durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 'Could not read the reference audio duration. Choose a supported audio file and try again.';
  }
  if (durationSeconds < MIN_AUDIO_DURATION_SECONDS) {
    return 'Reference audio must be at least 6 seconds long.';
  }
  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    return 'Reference audio must be no longer than 6 minutes.';
  }
  return null;
}

function readAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      URL.revokeObjectURL(objectUrl);
    };
    const handleLoadedMetadata = () => {
      const duration = audio.duration;
      cleanup();
      resolve(duration);
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Failed to read reference audio duration'));
    };

    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    try {
      audio.src = objectUrl;
      audio.load();
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('Failed to read reference audio duration'));
    }
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.onerror = () => reject(new Error('Failed to read reference audio'));
    reader.readAsDataURL(file);
  });
}

function buildCoverGenerationHref(result: CoverPreprocessResult): string {
  const params = new URLSearchParams(result.coverPreprocessId
    ? { coverPreprocessId: result.coverPreprocessId }
    : { coverFeatureId: result.coverFeatureId });
  return `/music?${params.toString()}`;
}

export default function MusicCoverPreprocessPage() {
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedAudioFile | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: number | null; message: string | null } | null>(null);
  const [result, setResult] = useState<CoverPreprocessResult | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const hasAudioUrl = audioUrl.trim().length > 0;
  const hasFile = selectedFile !== null;
  const validationMessage = (() => {
    if (hasAudioUrl && hasFile) return 'Use either a reference audio URL or a local upload, not both.';
    if (!hasAudioUrl && !hasFile) return 'Provide one reference audio source before preprocessing.';
    return null;
  })();
  const canPreprocess = !isLoading && !isReadingFile && validationMessage === null;

  const handleAudioFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    setResult(null);
    setActionStatus(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateAudioFile(file);
    if (validationError) {
      setSelectedFile(null);
      setError({ code: null, message: validationError });
      input.value = '';
      return;
    }

    setError(null);
    setIsReadingFile(true);
    try {
      const duration = await readAudioDurationSeconds(file);
      const durationError = validateAudioDuration(duration);
      if (durationError) {
        setSelectedFile(null);
        setError({ code: null, message: durationError });
        input.value = '';
        return;
      }
      const base64 = await readFileAsBase64(file);
      setSelectedFile({ name: file.name, size: file.size, base64 });
    } catch {
      setSelectedFile(null);
      setError({ code: null, message: 'Could not read the reference audio. Choose another file and try again.' });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handlePreprocess = async () => {
    if (validationMessage) {
      setError({ code: null, message: validationMessage });
      return;
    }

    setError(null);
    setActionStatus(null);
    setIsLoading(true);
    setResult(null);

    try {
      const response = await authFetch('/api/minimax/music/generations/cover-preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'music-cover',
          audioUrl: hasAudioUrl ? audioUrl.trim() : '',
          audioBase64: selectedFile?.base64 ?? '',
        }),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json() as CoverPreprocessResult;
      setResult(data);
      setActionStatus('Reference audio preprocessed. Use the cover feature ID within 24 hours for cover generation.');
    } catch {
      setError({ code: null, message: 'Failed to preprocess reference audio. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyFeatureId = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.coverFeatureId);
      setActionStatus('Cover feature ID copied to clipboard.');
    } catch {
      setActionStatus('Could not access the clipboard. Select the cover feature ID manually to copy it.');
    }
  };

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <ConsoleBand monogram="MU" title="Cover Preprocess" description="Prepare reference audio for MiniMax Music Cover and receive a 24-hour cover feature ID." note="Reference audio should be 6 seconds to 6 minutes, no larger than 50 MB, and in a common format like MP3, WAV, or FLAC." />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 0.95fr) minmax(0, 1.15fr)' }} gap={6} alignItems="start">
        <Sheet>
          <SheetHeader>
            <SheetTitle>Reference audio</SheetTitle>
            <SheetDescription>Provide exactly one source: a hosted audio URL or a local audio upload converted to base64 in the browser.</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
                        <Field label="Audio URL" htmlFor="cover-audio-url">
              <Input id="cover-audio-url" value={audioUrl} disabled={isLoading || isReadingFile} placeholder="https://example.com/reference.wav" onChange={(event) => setAudioUrl(event.currentTarget.value)} />
                            <Box color="content.readout" fontSize="sm">Use a public HTTP or HTTPS URL when your reference audio is already hosted.</Box>
            </Field>

                        <Field label="Local audio upload" htmlFor="cover-audio-file">
              <Input
                              id="cover-audio-file"
                              type="file"
                              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/mp4,audio/m4a,audio/aac,audio/ogg,.mp3,.wav,.flac,.m4a,.aac,.ogg"
                              disabled={isLoading || isReadingFile}
                              onChange={handleAudioFileChange}
                            />
                            <Box color="content.readout" fontSize="sm">The app sends the base64 payload to the server for this request only. It is not saved to Library or localStorage.</Box>
            </Field>

            {selectedFile && (
              <Box border="1px solid" borderColor="interaction.soft" borderRadius="lg" bg="surface.sheet" p="0.75rem" display="flex" justifyContent="space-between" gap={2} flexWrap="wrap" color="content.ink" fontSize="sm">
                <span>{selectedFile.name}</span>
                <span>{formatBytes(selectedFile.size)}</span>
              </Box>
            )}

            {validationMessage && (
              <Box border="1px solid" borderColor="state.runSoft" borderLeft="3px solid" borderLeftColor="state.run" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.run" fontSize="sm">
                {validationMessage}
              </Box>
            )}
            {error && <ErrorDisplay code={error.code ?? null} message={error.message ?? ''} />}
            {actionStatus && !error && (
              <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="state.ok" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
                {actionStatus}
              </Box>
            )}

            <Button onClick={handlePreprocess} disabled={!canPreprocess}>
              {isLoading ? 'Preprocessing audio...' : isReadingFile ? 'Preparing upload...' : 'Preprocess cover audio'}
            </Button>
          </SheetContent>
        </Sheet>

        <Sheet minH="28rem">
          <SheetHeader>
            <SheetTitle>Preprocess result</SheetTitle>
            <SheetDescription>{result ? 'The cover feature ID and the analysis MiniMax returned.' : 'Cover feature ID and MiniMax analysis appear here.'}</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {!result && !isLoading && (
              <Box border="1px dashed" borderColor="surface.rule" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                Preprocess a reference track first. Cover generation uses the returned cover feature ID in the next step.
              </Box>
            )}
            {isLoading && (
              <Box border="1px dashed" borderColor="interaction.soft" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                Uploading and preprocessing reference audio. This request is billed, so it is not retried automatically.
              </Box>
            )}
            {result && (
              <Box display="grid" gap={4} gridTemplateColumns="minmax(0, 1fr)">
                <Box border="1px solid" borderColor="state.okSoft" borderRadius="xl" bg="surface.sheet" p="1rem" display="grid" gap={3}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                    <Box>
                      <Box color="content.subtle" fontSize="xs">Cover feature ID</Box>
                      <Box fontWeight={700} style={{ wordBreak: 'break-all' }}>{result.coverFeatureId}</Box>
                    </Box>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      <Button variant="outline" size="sm" onClick={handleCopyFeatureId}>Copy ID</Button>
                      <a href={buildCoverGenerationHref(result)} style={{ color: 'var(--chakra-colors-interaction-accent)', fontWeight: 600, textDecoration: 'underline' }}>Use in cover generation</a>
                    </Box>
                  </Box>
                  <SpecList>
                    <Spec label="Reference" value={`${Math.round(result.audioDurationSeconds)}s`} />
                    <Spec label="Trace" value={result.traceId ?? 'not returned'} />
                    <Spec label="Valid for" value="24 hours" />
                  </SpecList>
                </Box>

                                <Field label="Formatted lyrics">
                  <Textarea value={result.formattedLyrics} readOnly minH="10rem" />
                </Field>

                <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
                  <Label>Structure result</Label>
                  <Box as="pre" whiteSpace="pre-wrap" border="1px solid" borderColor="state.okSoft" borderRadius="xl" bg="surface.sheet" p="1rem" color="content.ink" overflowX="auto">
                    {result.structureResult || 'No structure result returned'}
                  </Box>
                </Box>
              </Box>
            )}
          </SheetContent>
        </Sheet>
      </Box>
    </Box>
  );
}
