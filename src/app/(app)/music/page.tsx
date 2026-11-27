'use client';

import { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { AudioPlayer } from '@/components/tts/AudioPlayer';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, type SelectOption } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { authFetch, parseApiError } from '@/lib/auth-client';
import type { LibraryGenerationDTO } from '@/application/dto/library/LibraryDTO';
import { MUSIC_AVAILABILITY_NOTICE } from '@/application/dto/minimax/music/MusicDTO';
import { Field } from '@/components/ui/spec';

const PROMPT_MAX_LENGTH = 2000;
const COVER_PROMPT_MIN_LENGTH = 10;
const COVER_PROMPT_MAX_LENGTH = 300;
const LYRICS_MAX_LENGTH = 3500;
const COVER_LYRICS_MIN_LENGTH = 10;
const COVER_LYRICS_MAX_LENGTH = 1000;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_BITRATE = 256000;

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'music-3.0', label: 'music-3.0' },
  { value: 'music-cover', label: 'music-cover' },
];

function isCoverModel(value: string): boolean {
  return value === 'music-cover';
}

function getInitialSearchParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

function getInitialModel(searchParams: URLSearchParams): string {
  const requestedModel = searchParams.get('model') ?? '';
  if (MODEL_OPTIONS.some((option) => option.value === requestedModel)) return requestedModel;
  return searchParams.get('coverFeatureId') || searchParams.get('coverPreprocessId') ? 'music-cover' : 'music-3.0';
}

function getStringMetadata(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberMetadata(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' ? value : undefined;
}

interface MusicGenerationResult {
  id: string;
  audio: string;
  format: 'mp3';
  metadata: {
    status?: string | number;
    traceId?: string;
    durationSeconds?: number;
    sampleRate?: number;
    channels?: number;
    bitrate?: number;
    sizeBytes?: number;
  };
}

function downloadMusicHex(hex: string, format: string, id: string): void {
  const clean = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `minimax-music-${id}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function MusicPage() {
  const [initialSearchParams] = useState(getInitialSearchParams);
  const [coverPreprocessId] = useState(() => initialSearchParams.get('coverPreprocessId')?.trim() ?? '');
  const [prompt, setPrompt] = useState(() => initialSearchParams.get('prompt') ?? initialSearchParams.get('style') ?? '');
  const [lyrics, setLyrics] = useState(() => initialSearchParams.get('lyrics') ?? '');
  const [coverFeatureId, setCoverFeatureId] = useState(() => initialSearchParams.get('coverFeatureId') ?? '');
  const [instrumental, setInstrumental] = useState(false);
  const [model, setModel] = useState(() => getInitialModel(initialSearchParams));
  const [isLoading, setIsLoading] = useState(false);
  const [isHydratingCoverPreprocess, setIsHydratingCoverPreprocess] = useState(false);
  const [error, setError] = useState<{ code: number | null; message: string | null } | null>(null);
  const [result, setResult] = useState<MusicGenerationResult | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const trimmedPrompt = prompt.trim();
  const trimmedLyrics = lyrics.trim();
  const trimmedCoverFeatureId = coverFeatureId.trim();
  const isCoverMode = isCoverModel(model);
  const promptMaxLength = isCoverMode ? COVER_PROMPT_MAX_LENGTH : PROMPT_MAX_LENGTH;
  const lyricsMaxLength = isCoverMode ? COVER_LYRICS_MAX_LENGTH : LYRICS_MAX_LENGTH;
  const promptCharacters = prompt.length;
  const lyricsCharacters = lyrics.length;
  const validationMessage = (() => {
    if (isHydratingCoverPreprocess) return 'Loading Cover Preprocess record from Library.';
    if (isCoverMode) {
      if (trimmedCoverFeatureId.length === 0) return 'Add a cover feature ID from Cover Preprocess before generating.';
      if (trimmedPrompt.length < COVER_PROMPT_MIN_LENGTH) return 'Describe the target cover style with at least 10 characters.';
      if (trimmedPrompt.length > COVER_PROMPT_MAX_LENGTH) return 'Cover style prompt exceeds 300 characters.';
      if (trimmedLyrics.length > 0 && trimmedLyrics.length < COVER_LYRICS_MIN_LENGTH) return 'Cover lyrics must be at least 10 characters when provided.';
      if (trimmedLyrics.length > COVER_LYRICS_MAX_LENGTH) return 'Cover lyrics exceed 1,000 characters.';
      if (instrumental) return 'Instrumental mode is not available for cover generation.';
      return null;
    }

    if (instrumental && trimmedPrompt.length === 0) return 'Describe the instrumental style before generating.';
    if (!instrumental && trimmedLyrics.length === 0) return 'Add lyrics before generating vocal music.';
    if (promptCharacters > PROMPT_MAX_LENGTH) return 'Prompt exceeds 2,000 characters.';
    if (lyricsCharacters > LYRICS_MAX_LENGTH) return 'Lyrics exceed 3,500 characters.';
    return null;
  })();
  const canGenerate = !isLoading && validationMessage === null;

  useEffect(() => {
    if (!coverPreprocessId) return;

    let isCancelled = false;

    const loadCoverPreprocessGeneration = async () => {
      setIsHydratingCoverPreprocess(true);
      setError(null);
      setActionStatus(null);

      try {
        const response = await authFetch(`/api/library/generations/${encodeURIComponent(coverPreprocessId)}`);

        if (!response.ok) {
          const err = await parseApiError(response);
          if (!isCancelled) {
            const message = err?.message ?? `HTTP ${response.status}`;
            setError({
              code: err?.code ?? response.status,
              message: `Cover Preprocess record is unavailable (${message}). Run Cover Preprocess again from Library or the Cover Preprocess page.`,
            });
          }
          return;
        }

        const data = await response.json() as { generation?: LibraryGenerationDTO };
        const generation = data.generation;
        if (!generation || generation.source !== 'cover-preprocess') {
          if (!isCancelled) {
            setError({ code: null, message: 'This Library record is not a Cover Preprocess result.' });
          }
          return;
        }

        const coverFeatureIdFromMetadata = getStringMetadata(generation.metadata, 'coverFeatureId');
        const formattedLyrics = getStringMetadata(generation.metadata, 'formattedLyrics') ?? '';
        const expiresAt = getNumberMetadata(generation.metadata, 'expiresAt');

        if (!coverFeatureIdFromMetadata || !expiresAt) {
          if (!isCancelled) {
            setError({ code: null, message: 'This Cover Preprocess record is missing the cover feature metadata. Run Cover Preprocess again.' });
          }
          return;
        }

        if (expiresAt <= Date.now()) {
          if (!isCancelled) {
            setError({ code: null, message: 'This Cover Preprocess record has expired. Run Cover Preprocess again before generating a cover.' });
          }
          return;
        }

        if (!isCancelled) {
          setModel(isCoverModel(generation.model ?? '') ? generation.model ?? 'music-cover' : 'music-cover');
          setInstrumental(false);
          setCoverFeatureId(coverFeatureIdFromMetadata);
          setLyrics(formattedLyrics);
          setActionStatus('Loaded Cover Preprocess record from Library. Add a target cover style to continue.');
        }
      } catch {
        if (!isCancelled) {
          setError({ code: null, message: 'Failed to load Cover Preprocess record from Library. Check your connection and try again.' });
        }
      } finally {
        if (!isCancelled) setIsHydratingCoverPreprocess(false);
      }
    };

    void loadCoverPreprocessGeneration();

    return () => {
      isCancelled = true;
    };
  }, [coverPreprocessId]);

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    if (isCoverModel(nextModel)) setInstrumental(false);
  };

  const handleGenerate = async () => {
    if (validationMessage) {
      setError({ code: null, message: validationMessage });
      return;
    }

    setError(null);
    setActionStatus(null);
    setIsLoading(true);
    setResult(null);

    try {
      const response = await authFetch('/api/minimax/music/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: trimmedPrompt,
          lyrics: isCoverMode ? trimmedLyrics : instrumental ? '' : trimmedLyrics,
          instrumental: isCoverMode ? false : instrumental,
          ...(isCoverMode ? { coverFeatureId: trimmedCoverFeatureId } : {}),
          stream: false,
          outputFormat: 'hex',
          audioSetting: {
            sampleRate: DEFAULT_SAMPLE_RATE,
            bitrate: DEFAULT_BITRATE,
            format: 'mp3',
          },
        }),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json() as MusicGenerationResult;
      setResult(data);
      setActionStatus('Music generated and saved to backend Library. The preview remains available on this page.');
    } catch {
      setError({ code: null, message: 'Failed to generate music. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box display="grid" gap={6} width="100%">
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box maxW="52rem">
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Music Generation</h1>
          <Box color="content.readout" mt={1}>
            Create full MiniMax music tracks from lyrics and style direction, or complete cover generation with a preprocessed cover feature ID.
          </Box>
        </Box>
        <Box border="1px solid" borderColor="interaction.soft" borderLeft="3px solid" borderLeftColor="purple.400" borderRadius="md" bg="surface.sheet" p="0.75rem" color="content.ink" fontSize="sm" maxW="24rem">
          Output is MP3 at 44.1 kHz and 256 kbps. Generated audio is stored by the backend when bytes are available.
        </Box>
      </Box>

      <Box border="1px solid" borderColor="state.runSoft" borderLeft="3px solid" borderLeftColor="orange.400" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.run" fontSize="sm">
        {MUSIC_AVAILABILITY_NOTICE}
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 0.95fr) minmax(0, 1.15fr)' }} gap={6} alignItems="start">
        <Sheet>
          <SheetHeader>
            <SheetTitle>{isCoverMode ? 'Cover Generation Brief' : 'Composition Brief'}</SheetTitle>
            <SheetDescription>
              {isCoverMode
                ? 'Step 2 after Cover Preprocess: choose the target cover style and optionally edit the detected lyrics.'
                : 'Guide the arrangement with genre, mood, tempo, instrumentation, structure, and production references.'}
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {isCoverMode && (
              <Box border="1px solid" borderColor="interaction.soft" borderLeft="3px solid" borderLeftColor="purple.400" borderRadius="md" bg="surface.sheet" p="0.75rem" color="content.ink" fontSize="sm">
                Cover generation requires a cover feature ID from Cover Preprocess. The ID expires 24 hours after preprocessing.
              </Box>
            )}

            <Box display="flex" alignItems="center" justifyContent="space-between" gap={3} border="1px solid" borderColor="interaction.soft" borderRadius="lg" p="0.75rem" bg="surface.sheet">
              <Box>
                <Label htmlFor="instrumental-mode">Instrumental mode</Label>
                <Box color="content.readout" fontSize="sm">{isCoverMode ? 'Disabled for MiniMax cover models.' : 'Use prompt-only generation when you do not need vocals.'}</Box>
              </Box>
              <Switch id="instrumental-mode" checked={isCoverMode ? false : instrumental} onChange={setInstrumental} disabled={isLoading || isCoverMode} />
            </Box>

            {isCoverMode && (
                            <Field label="Cover feature ID" htmlFor="cover-feature-id">
                <Input
                                  id="cover-feature-id"
                                  value={coverFeatureId}
                                  onChange={(event) => setCoverFeatureId(event.currentTarget.value)}
                                  disabled={isLoading}
                                  placeholder="cover_feature_id from Cover Preprocess"
                                />
                                <Box color="content.readout" fontSize="sm">Use the ID within 24 hours of preprocessing the reference audio.</Box>
              </Field>
            )}

            <Box display="grid" gap={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="music-prompt">{isCoverMode ? 'Target cover style' : 'Style prompt'}</Label>
                <Box as="span" color={promptCharacters > promptMaxLength ? 'red.600' : 'gray.500'} fontSize="sm">
                  {promptCharacters}/{promptMaxLength}
                </Box>
              </Box>
              <Textarea
                id="music-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                disabled={isLoading}
                maxLength={promptMaxLength + 100}
                minH="8rem"
                placeholder={isCoverMode ? 'Example: Dreamy acoustic bossa nova with soft nylon guitar, warm percussion, and intimate vocals.' : 'Example: Cinematic synth-pop at 118 BPM, bright analog bass, crisp drums, uplifting chorus, glossy modern mix.'}
              />
              <Box color="content.readout" fontSize="sm">
                {isCoverMode ? 'Required for cover generation. Use 10 to 300 characters to describe the target cover style.' : instrumental ? 'Required for instrumental music.' : 'Optional for vocal music, but strongly recommended for better direction.'}
              </Box>
            </Box>

            <Box display="grid" gap={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="music-lyrics">{isCoverMode ? 'Lyrics (optional)' : 'Lyrics'}</Label>
                <Box as="span" color={lyricsCharacters > lyricsMaxLength ? 'red.600' : 'gray.500'} fontSize="sm">
                  {lyricsCharacters}/{lyricsMaxLength}
                </Box>
              </Box>
              <Textarea
                id="music-lyrics"
                value={lyrics}
                onChange={(event) => setLyrics(event.currentTarget.value)}
                disabled={isLoading || (!isCoverMode && instrumental)}
                maxLength={lyricsMaxLength + 100}
                minH="14rem"
                placeholder={'[Verse]\nLate city lights and a silver sky\n[Chorus]\nWe keep moving where the echoes fly'}
              />
              <Box color="content.readout" fontSize="sm">
                {isCoverMode ? 'Optional for cover generation. If provided, use 10 to 1,000 characters.' : 'Use structure tags like [Intro], [Verse], [Chorus], and [Bridge]. Lyrics are required when instrumental mode is off.'}
              </Box>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={4}>
                            <Field label="Model">
                <Select value={model} onValueChange={handleModelChange} options={MODEL_OPTIONS} disabled={isLoading} />
              </Field>
              <Box display="grid" gap={2}>
                <Label>Audio settings</Label>
                <Box border="1px solid" borderColor="surface.rule" borderRadius="lg" bg="surface.sheet" px="0.75rem" py="0.5rem" color="content.ink" fontSize="sm">
                  MP3 · 44.1 kHz · 256 kbps
                </Box>
              </Box>
            </Box>

            {validationMessage && (
              <Box border="1px solid" borderColor="state.runSoft" borderLeft="3px solid" borderLeftColor="orange.400" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.run" fontSize="sm">
                {validationMessage}
              </Box>
            )}
            {error && <ErrorDisplay code={error.code ?? null} message={error.message ?? ''} />}
            {actionStatus && !error && (
              <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="green.400" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
                {actionStatus}
              </Box>
            )}

            <Button onClick={handleGenerate} disabled={!canGenerate} colorPalette="purple">
              {isLoading ? 'Generating music...' : isCoverMode ? 'Generate Cover' : 'Generate Music'}
            </Button>
          </SheetContent>
        </Sheet>

        <Sheet minH="28rem">
          <SheetHeader>
            <SheetTitle>Track Preview</SheetTitle>
            <SheetDescription>
              {result
                ? `${result.metadata.durationSeconds ? `${Math.round(result.metadata.durationSeconds)}s · ` : ''}${result.format.toUpperCase()} · ${result.metadata.sampleRate ?? DEFAULT_SAMPLE_RATE} Hz`
                : isCoverMode ? 'Generated covers appear here with playback, download, and Library persistence.' : 'Generated tracks appear here with playback, download, and Library persistence.'}
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {isLoading && (
              <Box border="1px dashed" borderColor="interaction.soft" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                Composing your track with MiniMax Music. Keep this tab open until generation completes.
              </Box>
            )}

            {!isLoading && !result && (
              <Box border="1px dashed" borderColor="surface.rule" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                {isCoverMode ? 'Start from a valid cover feature ID and target cover style. Your generated cover will be saved to backend Library automatically when bytes are available.' : 'Start with a focused brief and complete lyrics. Your generated track will be saved to backend Library automatically when bytes are available.'}
              </Box>
            )}

            {result && (
              <Box display="grid" gap={4}>
                <Box border="1px solid" borderColor="state.okSoft" borderRadius="xl" bg="surface.sheet" p="1rem" display="grid" gap={3}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                    <Box>
                      <Box fontWeight={700}>Generated track</Box>
                      <Box color="content.readout" fontSize="sm">Trace: {result.metadata.traceId ?? result.id}</Box>
                    </Box>
                    <Button variant="outline" colorPalette="blue" size="sm" onClick={() => downloadMusicHex(result.audio, result.format, result.id)}>
                      Download MP3
                    </Button>
                  </Box>
                  <AudioPlayer hex={result.audio} format={result.format} onDownload={() => downloadMusicHex(result.audio, result.format, result.id)} />
                </Box>

                <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}>
                  <Box border="1px solid" borderColor="surface.rule" borderRadius="lg" bg="surface.sheet" p="0.75rem">
                    <Box color="content.subtle" fontSize="xs">Mode</Box>
                    <Box fontWeight={700}>{isCoverMode ? 'Cover' : instrumental ? 'Instrumental' : 'Vocal'}</Box>
                  </Box>
                  <Box border="1px solid" borderColor="surface.rule" borderRadius="lg" bg="surface.sheet" p="0.75rem">
                    <Box color="content.subtle" fontSize="xs">Model</Box>
                    <Box fontWeight={700}>{model}</Box>
                  </Box>
                  <Box border="1px solid" borderColor="surface.rule" borderRadius="lg" bg="surface.sheet" p="0.75rem">
                    <Box color="content.subtle" fontSize="xs">Bitrate</Box>
                    <Box fontWeight={700}>{Math.round((result.metadata.bitrate ?? DEFAULT_BITRATE) / 1000)} kbps</Box>
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
