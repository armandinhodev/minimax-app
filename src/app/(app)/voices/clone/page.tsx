'use client';

/**
 * Voice clone workflow page.
 * Steps: upload audio, set voice_id, submit clone request.
 * Shows TTL countdown badge after successful clone.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { TTLCounter } from '@/components/shared/TTLCounter';
import { VoiceUpload } from '@/components/voice/VoiceUpload';
import { saveHistoryItem } from '@/lib/history';
import type { VoiceDTO } from '@/application/dto/minimax/speech/VoiceDTO';
import { MAX_UPLOAD_FILE_SIZE_MB, VOICE_UPLOAD_DURATION_LIMITS } from '@/lib/upload-policy';
import { Field } from '@/components/ui/spec';

// TTL for cloned voices: 168 hours (7 days) from MiniMax
const CLONE_TTL_MS = 168 * 60 * 60 * 1000;

export default function CloneVoicePage() {
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: number | null; message: string | null; details?: { upstreamStatus?: number; upstreamMessage?: string } } | null>(null);
  const [clonedVoice, setClonedVoice] = useState<VoiceDTO | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const handleFileSelected = (_file: File) => {
    setUploadedFileId(null);
    setClonedVoice(null);
    setError(null);
  };

  const handleUploadComplete = (fileId: string) => {
    setUploadedFileId(fileId);
    setError(null);
    setActionStatus('Audio uploaded. Add a voice ID, then clone the voice.');
  };

  const handleClone = async () => {
    if (!uploadedFileId) {
      setError({ code: null, message: 'Please upload an audio file first.' });
      return;
    }
    if (!voiceId.trim()) {
      setError({ code: null, message: 'Please enter a voice ID.' });
      return;
    }

    setError(null);
    setActionStatus(null);
    setIsLoading(true);

    try {
      const response = await authFetch('/api/minimax/speech/voices/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: uploadedFileId, voiceId: voiceId.trim() }),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({
          code: err?.code ?? response.status,
          message: err?.message ?? `HTTP ${response.status}`,
          details: err?.details,
        });
        return;
      }

      const data = await response.json();
      setClonedVoice(data.voice);
      setActionStatus('Voice cloned successfully and saved to Library. It is ready for Text to Speech.');
      saveHistoryItem({
        type: 'clone',
        voiceId: data.voice.voiceId,
        fileId: uploadedFileId,
        ttlExpiry: data.voice.ttlExpiry ?? Date.now() + CLONE_TTL_MS,
      });
    } catch {
      setError({ code: null, message: 'Failed to clone voice. Check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  const ttlExpiry = clonedVoice?.ttlExpiry ?? Date.now() + CLONE_TTL_MS;

  return (
    <Box display="grid" gap={6} maxW="36rem">
      <Box>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Clone a Voice</h1>
        <Box color="content.readout" mt={1}>
          Upload an audio sample ({VOICE_UPLOAD_DURATION_LIMITS.minSeconds}s–{VOICE_UPLOAD_DURATION_LIMITS.maxSeconds / 60}min, MP3/M4A/WAV, ≤{MAX_UPLOAD_FILE_SIZE_MB} MB) to create a voice clone.
        </Box>
      </Box>

      <Sheet>
        <SheetHeader>
          <SheetTitle>Voice Clone</SheetTitle>
          <SheetDescription>
            Upload a clean audio sample with clear speech. The clone will be ready shortly after generation.
          </SheetDescription>
        </SheetHeader>
        <SheetContent display="grid" gap={4}>
          <VoiceUpload onFileSelected={handleFileSelected} onUploadComplete={handleUploadComplete} />

          {/* Voice ID */}
                    <Field label="Voice ID" htmlFor="voice-id">
            <Input
                          id="voice-id"
                          placeholder="e.g. my-clone-voice-1"
                          value={voiceId}
                          onChange={(e) => setVoiceId(e.target.value)}
                          maxLength={256}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-content.readout)' }}>
                          A unique identifier for your voice (8–256 chars, starts with a letter).
                        </p>
          </Field>

          {error && <ErrorDisplay code={error.code} message={error.message} details={error.details} />}
          {actionStatus && !error && (
            <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="green.400" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
              {actionStatus}
            </Box>
          )}

          <Box display="flex" gap={2}>
            <Button onClick={handleClone} disabled={isLoading || !uploadedFileId} colorPalette="green">
              {isLoading ? 'Cloning...' : 'Clone Voice'}
            </Button>
          </Box>
        </SheetContent>
      </Sheet>

      {/* Success State */}
      {clonedVoice && (
        <Sheet>
          <SheetHeader>
            <SheetTitle>Voice Cloned Successfully</SheetTitle>
            <SheetDescription>
              Your voice clone is ready. Use the voice ID <code style={{ fontSize: '0.75rem', backgroundColor: 'var(--chakra-colors-surface.field)', padding: '0 0.25rem', borderRadius: '0.25rem' }}>{clonedVoice.voiceId}</code> in Text to Speech. Fresh clones may appear there before the MiniMax voice list refreshes.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            <Box display="flex" alignItems="center" gap={2}>
              <TTLCounter expiresAt={ttlExpiry} label="Voice TTL" />
              <span style={{ fontSize: '0.875rem', color: 'var(--chakra-colors-content.readout)' }}>
                Your cloned voice will expire after 7 days of inactivity.
              </span>
            </Box>
            <Box display="flex" gap={2}>
              <Link
                href="/tts"
                style={{ display: 'inline-flex', height: '2rem', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', borderRadius: 'var(--chakra-radii-md)', border: '1px solid transparent', backgroundColor: 'var(--chakra-colors-interaction-accent)', padding: '0 0.75rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--chakra-colors-content-inverse)' }}
              >
                Go to Text to Speech
              </Link>
              <Link
                href="/voices"
                style={{ display: 'inline-flex', height: '2rem', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', borderRadius: 'var(--chakra-radii-md)', border: '1px solid var(--chakra-colors-surface-rule)', backgroundColor: 'var(--chakra-colors-surface-sheet)', padding: '0 0.75rem', fontSize: '0.875rem' }}
              >
                View All Voices
              </Link>
            </Box>
          </SheetContent>
        </Sheet>
      )}
    </Box>
  );
}
