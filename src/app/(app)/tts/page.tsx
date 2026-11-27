'use client';

/**
 * Text-to-Speech page.
 * UI: text input, voice selector, format/speed/pitch controls, generate button, copy/download.
 */

import { useCallback, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, type SelectOption } from '@/components/ui/select';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { TextInput } from '@/components/tts/TextInput';
import { VoiceSelector } from '@/components/tts/VoiceSelector';
import { AudioPlayer } from '@/components/tts/AudioPlayer';
import { StreamingPlayer } from '@/components/tts/StreamingPlayer';
import { DEFAULT_T2A_FORMAT, DEFAULT_T2A_MODEL } from '@/domain/value-objects/T2APolicy';
import { Field } from '@/components/ui/spec';
import { ConsoleBand } from '@/components/ui/console-band';

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'speech-2.8-hd', label: 'speech-2.8-hd' },
  { value: 'speech-2.8', label: 'speech-2.8' },
  { value: 'speech-01', label: 'speech-01' },
];

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'pcm', label: 'PCM' },
  { value: 'flac', label: 'FLAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'opus', label: 'Opus' },
];

export default function TTSPage() {
  const [generateText, setGenerateText] = useState('');
  const [generateVoiceId, setGenerateVoiceId] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingVoiceId, setStreamingVoiceId] = useState('');
  const [model, setModel] = useState(DEFAULT_T2A_MODEL);
  const [format, setFormat] = useState(DEFAULT_T2A_FORMAT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: number | null; message: string | null } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioHex, setAudioHex] = useState<string | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [useWebSocketTransport, setUseWebSocketTransport] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const handleModelChange = useCallback((value: string) => {
    setModel(value as typeof model);
  }, []);

  const handleFormatChange = useCallback((value: string) => {
    setFormat(value as typeof format);
  }, []);

  const handleGenerate = async () => {
    if (!generateText.trim()) {
      setError({ code: null, message: 'Please enter some text.' });
      return;
    }
    if (generateText.length > 10000) {
      setError({ code: null, message: 'Text exceeds 10,000 characters.' });
      return;
    }
    if (!generateVoiceId.trim()) {
      setError({ code: null, message: 'Please select a voice.' });
      return;
    }

    setError(null);
    setActionStatus(null);
    setIsLoading(true);
    setAudioUrl(null);
    setAudioHex(null);

    try {
      const response = await authFetch('/api/minimax/speech/t2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: generateText, voiceId: generateVoiceId, model, format }),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json();

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setActionStatus('Audio generated and saved to Library as a temporary URL. Download it soon because provider URLs can expire.');
      } else if (data.audio) {
        setAudioHex(data.audio);
        setActionStatus('Audio generated and saved to Library. The preview remains available on this page.');
      }
    } catch {
      setError({ code: null, message: 'Failed to generate audio. Check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" maxW="42rem">
      <ConsoleBand
        monogram="SP"
        title="Text to Speech"
        description="Convert text to natural-sounding audio using MiniMax TTS. Generate Audio creates a reusable Library item; Streaming TTS is immediate playback only."
      />

      <Sheet>
        <SheetHeader>
          <SheetTitle>Generate audio</SheetTitle>
          <SheetDescription>
            Creates audio you can download now and find later in Library.
          </SheetDescription>
        </SheetHeader>
        <SheetContent display="grid" gap={4}>
          <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="state.ok" borderRadius="md" bg="surface.sheet" p="0.75rem" color="content.ink" fontSize="sm">
            Best for finished clips, exports, and anything you want to keep in Library.
          </Box>
          {/* Text Input — Phase 6 component */}
          <TextInput
            value={generateText}
            onChange={setGenerateText}
            id="tts-text"
            label="Text"
            disabled={isLoading}
          />

          {/* Voice Selector — Phase 6 component */}
          <VoiceSelector
            value={generateVoiceId}
            onChange={setGenerateVoiceId}
            label="Voice"
            disabled={isLoading}
          />

          {/* Model & Format */}
          <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={4}>
                        <Field label="Model">
              <Select
                              value={model}
                              onValueChange={handleModelChange}
                              options={MODEL_OPTIONS}
                            />
            </Field>
                        <Field label="Format">
              <Select
                              value={format}
                              onValueChange={handleFormatChange}
                              options={FORMAT_OPTIONS}
                            />
            </Field>
          </Box>

          {error && <ErrorDisplay code={error.code ?? null} message={error.message ?? ''} />}
          {actionStatus && !error && (
            <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="state.ok" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
              {actionStatus}
            </Box>
          )}

          <Box display="flex" gap={2}>
            <Button onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate'}
            </Button>
            {audioUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(audioUrl, '_blank')}
              >
                Download
              </Button>
            )}
          </Box>

          {/* Audio Preview — Phase 6 AudioPlayer component */}
          {audioHex && (
            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Label>Preview</Label>
              <AudioPlayer hex={audioHex} format={format} />
            </Box>
          )}
        </SheetContent>
      </Sheet>

      {/* Streaming TTS — Phase 6 StreamingPlayer component */}
      <Sheet>
        <SheetHeader>
          <SheetTitle>Streaming TTS</SheetTitle>
          <SheetDescription>
            Plays audio immediately while it is generated. Streaming playback is not saved to Library.
          </SheetDescription>
        </SheetHeader>
        <SheetContent display="grid" gap={4}>
          <Box border="1px solid" borderColor="interaction.soft" borderLeft="3px solid" borderLeftColor="interaction.accent" borderRadius="md" bg="surface.sheet" p="0.75rem" color="content.ink" fontSize="sm">
            Best for fast previews and live playback. Use Generate Audio when you need a downloadable Library item.
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Label htmlFor="streaming-toggle" style={{ fontSize: '0.875rem' }}>Enable streaming</Label>
            <Button
              id="streaming-toggle"
              variant={streamingEnabled ? 'default' : 'outline'}
              size="sm"
              aria-pressed={streamingEnabled}
              onClick={() => setStreamingEnabled((prev) => !prev)}
            >
              {streamingEnabled ? 'On' : 'Off'}
            </Button>
          </Box>
          {streamingEnabled && (
            <>
              <Box display="flex" alignItems="center" gap={2}>
                <Label htmlFor="streaming-transport" style={{ fontSize: '0.875rem' }}>
                  Transport
                </Label>
                <Button
                  id="streaming-transport"
                  variant={useWebSocketTransport ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={useWebSocketTransport}
                  onClick={() => setUseWebSocketTransport((prev) => !prev)}
                >
                  {useWebSocketTransport ? 'WebSocket' : 'HTTP SSE'}
                </Button>
              </Box>
              <Box border="1px solid" borderColor="interaction.soft" borderLeft="3px solid" borderLeftColor="interaction.accent" borderRadius="md" bg="surface.sheet" p="0.75rem" color="content.ink" fontSize="sm">
                {useWebSocketTransport
                  ? 'The server holds a WebSocket to MiniMax and relays the audio as it arrives. The API key never reaches the browser.'
                  : 'The server relays the MiniMax HTTP stream as Server-Sent Events.'}
              </Box>
              <TextInput
                value={streamingText}
                onChange={setStreamingText}
                id="stream-text"
                label="Streaming Text"
                disabled={isLoading}
              />
              <VoiceSelector
                value={streamingVoiceId}
                onChange={setStreamingVoiceId}
                label="Streaming Voice"
                disabled={isLoading}
              />
              <StreamingPlayer
                text={streamingText}
                voiceId={streamingVoiceId}
                model={model}
                enabled={streamingEnabled}
                endpoint={useWebSocketTransport ? '/api/minimax/speech/t2a/websocket' : undefined}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </Box>
  );
}
