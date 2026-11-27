'use client';

import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { MUSIC_AVAILABILITY_NOTICE } from '@/application/dto/minimax/music/MusicDTO';
import { Field } from '@/components/ui/spec';
import { Badge } from '@/components/ui/badge';
import { AreaHeader } from '@/components/ui/area-header';

const PROMPT_MAX_LENGTH = 2000;
const LYRICS_MAX_LENGTH = 3500;

const MODE_OPTIONS: SelectOption[] = [
  { value: 'write_full_song', label: 'Write full song' },
  { value: 'edit', label: 'Edit existing lyrics' },
];

interface LyricsGenerationResult {
  songTitle: string;
  styleTags: string[];
  lyrics: string;
  metadata: {
    status?: number;
    message?: string;
  };
}

function buildMusicGenerationHref(result: LyricsGenerationResult, prompt: string): string {
  const params = new URLSearchParams();
  params.set('lyrics', result.lyrics);
  if (prompt.trim()) params.set('prompt', prompt.trim());
  return `/music?${params.toString()}`;
}

export default function LyricsGenerationPage() {
  const [mode, setMode] = useState('write_full_song');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: number | null; message: string | null } | null>(null);
  const [result, setResult] = useState<LyricsGenerationResult | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const validationMessage = (() => {
    if (prompt.length > PROMPT_MAX_LENGTH) return 'Prompt exceeds 2,000 characters.';
    if (lyrics.length > LYRICS_MAX_LENGTH) return 'Lyrics exceed 3,500 characters.';
    if (mode === 'write_full_song' && prompt.trim().length === 0) return 'Write a prompt describing the song you want.';
    if (mode === 'edit' && lyrics.trim().length === 0) return 'Paste the lyrics you want MiniMax to edit.';
    return null;
  })();
  const canGenerate = !isLoading && validationMessage === null;

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
      const response = await authFetch('/api/minimax/music/generations/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          lyrics: lyrics.trim(),
          title: title.trim(),
        }),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json() as LyricsGenerationResult;
      setResult(data);
      setActionStatus('Lyrics generated. Copy them or open Music Generation with these lyrics prefilled.');
    } catch {
      setError({ code: null, message: 'Failed to generate lyrics. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLyrics = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.lyrics);
      setActionStatus('Lyrics copied to clipboard.');
    } catch {
      setActionStatus('Could not access the clipboard. Select the lyrics manually to copy them.');
    }
  };

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <AreaHeader title="Lyrics" description="Draft a lyric sheet or revise an existing one." />

      <Box borderRadius="md" bg="state.runSoft" px="12px" py="10px" color="content.ink" fontSize="label">
        {MUSIC_AVAILABILITY_NOTICE}
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 7fr) minmax(0, 5fr)' }} gap={4} alignItems="start">
        <Sheet>
          <SheetHeader icon="file">
            <SheetTitle>Lyric brief</SheetTitle>
            <SheetDescription>Choose a mode and write the brief.</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={4}>
                            <Field label="Mode" htmlFor="lyrics-title">
                <Select value={mode} onValueChange={setMode} options={MODE_OPTIONS} disabled={isLoading} />
              </Field>
                            <Field label="Title" htmlFor="lyrics-title">
                <Input id="lyrics-title" value={title} disabled={isLoading} placeholder="Neon Afterglow" onChange={(event) => setTitle(event.currentTarget.value)} />
              </Field>
            </Box>

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="lyrics-prompt">Prompt</Label>
                <Box as="span" color={prompt.length > PROMPT_MAX_LENGTH ? 'state.err' : 'content.subtle'} fontSize="sm">{prompt.length}/{PROMPT_MAX_LENGTH}</Box>
              </Box>
              <Textarea
                id="lyrics-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                disabled={isLoading}
                maxLength={PROMPT_MAX_LENGTH + 100}
                minH="9rem"
                placeholder="Example: Write a hopeful synth-pop song about rebuilding trust after a long night drive. Keep the chorus memorable and direct."
              />
            </Box>

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="source-lyrics">Existing lyrics</Label>
                <Box as="span" color={lyrics.length > LYRICS_MAX_LENGTH ? 'state.err' : 'content.subtle'} fontSize="sm">{lyrics.length}/{LYRICS_MAX_LENGTH}</Box>
              </Box>
              <Textarea
                id="source-lyrics"
                value={lyrics}
                onChange={(event) => setLyrics(event.currentTarget.value)}
                disabled={isLoading}
                maxLength={LYRICS_MAX_LENGTH + 100}
                minH="14rem"
                placeholder={'[Verse]\nDraft lyrics to revise...\n[Chorus]\nA stronger hook goes here'}
              />
            </Box>

            {validationMessage && (
              <Box borderRadius="md" bg="state.runSoft" px="12px" py="10px" color="content.ink" fontSize="label">
                {validationMessage}
              </Box>
            )}
            {error && <ErrorDisplay code={error.code ?? null} message={error.message ?? ''} />}
            {actionStatus && !error && (
              <Box borderRadius="md" bg="state.okSoft" px="12px" py="10px" color="content.ink" fontSize="label">
                {actionStatus}
              </Box>
            )}

            <Button onClick={handleGenerate} disabled={!canGenerate}>
              {isLoading ? 'Generating lyrics...' : 'Generate lyrics'}
            </Button>
          </SheetContent>
        </Sheet>

        <Sheet minH="28rem">
          <SheetHeader icon="folder">
            <SheetTitle>Generated lyrics</SheetTitle>
            <SheetDescription>{result ? result.songTitle || 'Untitled song' : 'Lyrics, title, and style tags appear here after generation.'}</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {!result && !isLoading && (
              <Box borderRadius="md" p="2rem" textAlign="center" color="content.readout" bg="surface.inset">
                Write a focused brief, then generate lyrics ready for music generation.
              </Box>
            )}
            {isLoading && (
              <Box borderRadius="md" p="2rem" textAlign="center" color="content.readout" bg="surface.inset">
                Writing lyrics with MiniMax Music. This request is billed, so it is not retried automatically.
              </Box>
            )}
            {result && (
              <Box display="grid" gap={4} gridTemplateColumns="minmax(0, 1fr)">
                <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                  <Box display="flex" gap={2} flexWrap="wrap">
                    {result.styleTags.length ? (
                      result.styleTags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)
                    ) : (
                      <Box color="content.readout" fontSize="sm">No style tags returned</Box>
                    )}
                  </Box>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Button variant="outline" size="sm" onClick={handleCopyLyrics}>Copy lyrics</Button>
                    <Box asChild borderRadius="md" bg="var(--chakra-colors-state-ok)" color="var(--chakra-colors-content-inverse)" px="0.75rem" py="0.4rem" fontSize="sm" fontWeight={600} textDecoration="none">
                      <a href={buildMusicGenerationHref(result, prompt)}>Use in music generation</a>
                    </Box>
                  </Box>
                </Box>
                <Box as="pre" whiteSpace="pre-wrap" border="1px solid" borderColor="state.okSoft" borderRadius="xl" bg="surface.sheet" p="1rem" color="content.ink" overflowX="auto">
                  {result.lyrics}
                </Box>
              </Box>
            )}
          </SheetContent>
        </Sheet>
      </Box>
    </Box>
  );
}
