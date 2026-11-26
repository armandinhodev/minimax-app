'use client';

/**
 * ASR Studio — transcription with MiniMax Speech-to-Text.
 *
 * The audio file never leaves the browser except through the app's own API
 * route: the browser posts multipart/form-data to /api/minimax/asr/transcriptions,
 * and the server relays it to POST /v1/speech_to_text.
 */

import { useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, type SelectOption } from '@/components/ui/select';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { authFetch } from '@/lib/auth-client';

import {
  ASR_AUDIO_EXTENSIONS,
  validateAudioFile,
} from '@/application/dto/minimax/asr/AsrDTO';

/** Extensiones admitidas por el servidor, en el mismo orden. */
const ACCEPTED_EXTENSIONS = ASR_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(',');

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'json', label: 'JSON — plain transcript' },
  { value: 'verbose_json', label: 'Verbose JSON — segments and speakers' },
  { value: 'srt', label: 'SRT subtitles' },
  { value: 'vtt', label: 'VTT subtitles' },
];

const TIMESTAMP_OPTIONS: SelectOption[] = [
  { value: 'default', label: 'Default (segment level)' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'word', label: 'Word' },
];

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'auto', label: 'Auto — mixed language' },
  { value: 'zh', label: 'Chinese' },
  { value: 'yue', label: 'Cantonese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ms', label: 'Malay' },
  { value: 'fil', label: 'Filipino' },
  { value: 'ar', label: 'Arabic' },
  { value: 'tr', label: 'Turkish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
];

/** Formats that enable speaker diarization and forced alignment. */
const DIARIZATION_FORMATS = ['verbose_json', 'srt', 'vtt'];

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

interface TranscriptResult {
  text: string;
  duration: number;
  nSpeakers?: number;
  segments?: TranscriptSegment[];
  traceId?: string;
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
}

export default function AsrPage() {
  const [file, setFile] = useState<File | null>(null);
  const [responseFormat, setResponseFormat] = useState('json');
  const [timestampLevel, setTimestampLevel] = useState('default');
  const [language, setLanguage] = useState('auto');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [subtitles, setSubtitles] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDiarizationFormat = DIARIZATION_FORMATS.includes(responseFormat);
  /**
   * The file is validated before it is uploaded: an unsupported container
   * must not travel to the backend.
   */
  const fileError = file ? validateAudioFile(file.name, file.size) : null;
  const canTranscribe = !isTranscribing && file !== null && fileError === null;

  const buildFormData = (): FormData => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    formData.append('model', 'asr-1.0');
    formData.append('response_format', responseFormat);
    formData.append('timestamp_level', timestampLevel === 'default' ? '' : timestampLevel);
    formData.append('language', language === 'auto' ? '' : language);
    return formData;
  };

  const handleTranscribe = async () => {
    if (!file) {
      setError('Choose an audio file first.');
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setNotice(null);
    setTranscript(null);
    setSubtitles(null);
    setStreamedText('');

    try {
      const response = await authFetch('/api/minimax/asr/transcriptions', {
        method: 'POST',
        body: buildFormData(),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? `Transcription failed (HTTP ${response.status}).`);
        return;
      }

      if (responseFormat === 'srt' || responseFormat === 'vtt') {
        setSubtitles(await response.text());
        setNotice('Subtitles generated.');
        return;
      }

      setTranscript(await response.json() as TranscriptResult);
      setNotice('Transcription complete.');
    } catch {
      setError('Failed to transcribe. Check your connection and try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleStream = async () => {
    if (!file) {
      setError('Choose an audio file first.');
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setNotice(null);
    setTranscript(null);
    setSubtitles(null);
    setStreamedText('');

    try {
      const response = await authFetch('/api/minimax/asr/transcriptions/stream', {
        method: 'POST',
        body: buildFormData(),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? `Streaming failed (HTTP ${response.status}).`);
        return;
      }

      if (!response.body) {
        setError('The stream came back empty.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice('data:'.length).trim();
            if (!payload) continue;
            try {
              const event = JSON.parse(payload) as { delta?: string };
              if (typeof event.delta === 'string' && event.delta.length > 0) {
                setStreamedText((current) => current + event.delta);
              }
            } catch {
              // Ignore malformed events: the transcript keeps whatever arrived.
            }
          }

          boundary = buffer.indexOf('\n\n');
        }
      }

      setNotice('Streaming transcription finished.');
    } catch {
      setError('Failed to stream the transcription. Check your connection and try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <Box display="grid" gap={6} width="100%">
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box maxW="52rem">
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Transcription</h1>
          <Box color="gray.600" mt={1}>
            Turn audio into text with MiniMax ASR. Get a plain transcript, speaker segments, or
            ready-to-use subtitles.
          </Box>
        </Box>
        <Box border="1px solid" borderColor="orange.100" borderLeft="3px solid" borderLeftColor="orange.400" borderRadius="md" bg="white" p="0.75rem" color="gray.700" fontSize="sm" maxW="24rem">
          Audio is billed by its duration. Clips up to 500 seconds and 50MB are accepted.
        </Box>
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6} alignItems="start">
        <Card accent="orange">
          <CardHeader>
            <CardTitle>Audio</CardTitle>
            <CardDescription>Pick a recording to transcribe. It is sent to MiniMax ASR through this app.</CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            <Box display="grid" gap={2}>
              <Label htmlFor="asr-file">Audio file</Label>
              <Input
                id="asr-file"
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                ref={fileInputRef}
                onChange={(event) => {
                  setFile(event.currentTarget.files?.[0] ?? null);
                  setError(null);
                  setNotice(null);
                  setTranscript(null);
                  setSubtitles(null);
                }}
              />
            </Box>

            <Box display="grid" gap={2}>
              <Label htmlFor="asr-format">Output format</Label>
              <Select
                id="asr-format"
                value={responseFormat}
                options={FORMAT_OPTIONS}
                disabled={isTranscribing}
                onValueChange={(value) => {
                  setResponseFormat(value);
                  setTranscript(null);
                  setSubtitles(null);
                }}
              />
            </Box>

            {isDiarizationFormat && (
              <Box display="grid" gap={2}>
                <Label htmlFor="asr-timestamp-level">Timestamp granularity</Label>
                <Select
                  id="asr-timestamp-level"
                  value={timestampLevel}
                  options={TIMESTAMP_OPTIONS}
                  disabled={isTranscribing}
                  onValueChange={setTimestampLevel}
                />
              </Box>
            )}

            <Box display="grid" gap={2}>
              <Label htmlFor="asr-language">Spoken language</Label>
              <Select
                id="asr-language"
                value={language}
                options={LANGUAGE_OPTIONS}
                disabled={isTranscribing}
                onValueChange={setLanguage}
              />
            </Box>

            {fileError && !error && <ErrorDisplay message={fileError} />}
            {error && <ErrorDisplay message={error} />}
            {notice && !error && (
              <Box border="1px solid" borderColor="green.100" borderLeft="3px solid" borderLeftColor="green.400" borderRadius="md" bg="white" p="0.75rem" color="green.800" fontSize="sm">
                {notice}
              </Box>
            )}

            <Box display="flex" gap={3} flexWrap="wrap">
              <Button onClick={handleTranscribe} disabled={!canTranscribe} colorPalette="orange">
                {isTranscribing ? 'Transcribing...' : 'Transcribe'}
              </Button>
              <Button
                onClick={handleStream}
                disabled={!canTranscribe}
                variant="outline"
                colorPalette="orange"
              >
                Stream transcript
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card accent="green" minH="24rem">
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>
              {transcript
                ? `${transcript.duration.toFixed(2)}s of audio`
                : 'The transcription appears here once MiniMax finishes.'}
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            {streamedText.length > 0 && (
              <Box border="1px solid" borderColor="blue.100" borderRadius="xl" bg="white" p="1rem" color="gray.800" whiteSpace="pre-wrap">
                {streamedText}
              </Box>
            )}

            {!transcript && !subtitles && streamedText.length === 0 && !isTranscribing && (
              <Box border="1px dashed" borderColor="gray.200" borderRadius="xl" p="2rem" textAlign="center" color="gray.600" bg="white">
                {file
                  ? fileError
                    ? `The selected file cannot be transcribed: ${fileError}`
                    : `Ready to transcribe ${file.name}.`
                  : 'Choose an audio file to start.'}
              </Box>
            )}

            {isTranscribing && !transcript && !subtitles && streamedText.length === 0 && (
              <Box border="1px dashed" borderColor="orange.200" borderRadius="xl" p="2rem" textAlign="center" color="gray.600" bg="white">
                MiniMax is transcribing. This request is billed by audio duration.
              </Box>
            )}

            {subtitles !== null && (
              <Box as="pre" whiteSpace="pre-wrap" border="1px solid" borderColor="green.100" borderRadius="xl" bg="white" p="1rem" color="gray.800" overflowX="auto">
                {subtitles}
              </Box>
            )}

            {transcript && (
              <Box display="grid" gap={4}>
                <Box display="flex" gap={4} flexWrap="wrap" color="gray.600" fontSize="sm">
                  <span>Duration: {transcript.duration.toFixed(2)}s</span>
                  {transcript.nSpeakers !== undefined && <span>Speakers: {transcript.nSpeakers}</span>}
                </Box>

                {transcript.segments && transcript.segments.length > 0 ? (
                  <Box display="grid" gap="0.25rem">
                    {transcript.segments.map((segment) => (
                      <Box
                        key={segment.id}
                        display="grid"
                        gridTemplateColumns={{ base: '5.5rem', md: '8rem' }}
                        gap={2}
                        fontSize="sm"
                        color="gray.700"
                      >
                        <Box color="gray.500" fontFamily="monospace" fontSize="0.78rem">
                          {formatTimestamp(segment.start)}
                        </Box>
                        <Box>
                          {segment.speaker && (
                            <Box as="span" color="teal.700" fontWeight={700} fontSize="0.78rem" mr={2}>
                              {segment.speaker}
                            </Box>
                          )}
                          {segment.text}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box as="pre" whiteSpace="pre-wrap" border="1px solid" borderColor="green.100" borderRadius="xl" bg="white" p="1rem" color="gray.800" overflowX="auto">
                    {transcript.text}
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
