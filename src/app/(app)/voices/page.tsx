'use client';

/**
 * Voice gallery page.
 * Tabs: System voices | My voices.
 * VoiceCard grid with search/filter.
 */

import { useEffect, useMemo, useState } from 'react';
import { ScreenResetButton } from '@/components/shared/ScreenResetButton';
import { useScreenState } from '@/components/shared/screen-state';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import type { VoiceDTO } from '@/application/dto/minimax/speech/VoiceDTO';
import { VoiceCard } from '@/components/voice/VoiceCard';
import { VoiceGroupSection } from '@/components/voice/VoiceGroupSection';
import { getLanguageInfo } from '@/lib/language-flags';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { AreaHeader } from '@/components/ui/area-header';

export default function VoicesPage() {
  const [systemVoices, setSystemVoices] = useScreenState<VoiceDTO[]>('voices:systemVoices', []);
  const [userVoices, setUserVoices] = useScreenState<VoiceDTO[]>('voices:userVoices', []);
  const [isLoading, setIsLoading] = useScreenState('voices:isLoading', false);
  const [error, setError] = useScreenState<{ code: number | null; message: string | null } | null>('voices:error', null);
  const [filter, setFilter] = useScreenState('voices:filter', '');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteVoice, setPendingDeleteVoice] = useState<VoiceDTO | null>(null);
  const [actionStatus, setActionStatus] = useScreenState<string | null>('voices:actionStatus', null);

  const loadVoices = async () => {
    setIsLoading(true);
    setError(null);
    setActionStatus(null);

    try {
      const response = await authFetch('/api/minimax/speech/voices');

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json();
      const voices: VoiceDTO[] = data.voices ?? [];

      setSystemVoices(voices.filter((v) => v.type === 'system'));
      setUserVoices(voices.filter((v) => v.type !== 'system'));
    } catch {
      setError({ code: null, message: 'Failed to load voices. Check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVoices();
  }, []);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteVoice) return;
    const voice = pendingDeleteVoice;
    const { voiceId } = voice;

    setDeletingId(voiceId);
    try {
      const response = await authFetch('/api/minimax/speech/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, voiceType: voice.type === 'design' ? 'voice_generation' : 'voice_cloning' }),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      // Remove from user voices list
      setUserVoices((prev) => prev.filter((v) => v.voiceId !== voiceId));
      setActionStatus('Voice deleted from My voices.');
      setPendingDeleteVoice(null);
    } catch {
      setError({ code: null, message: 'Failed to delete voice.' });
    } finally {
      setDeletingId(null);
    }
  };

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredUserVoices = useMemo(() => {
    if (!normalizedFilter) return userVoices;
    return userVoices.filter(
      (voice) =>
        voice.name.toLowerCase().includes(normalizedFilter) ||
        voice.voiceId.toLowerCase().includes(normalizedFilter) ||
        (voice.language ?? '').toLowerCase().includes(normalizedFilter)
    );
  }, [userVoices, normalizedFilter]);

  const groupedSystemVoices = useMemo(() => {
    const groups = new Map<string, VoiceDTO[]>();
    for (const voice of systemVoices) {
      const language = voice.language ?? 'Unknown';
      groups.set(language, [...(groups.get(language) ?? []), voice]);
    }
    return [...groups.entries()]
      .map(([language, voices]) => ({ language, voices, ...getLanguageInfo(language) }))
      .sort((a, b) => b.voices.length - a.voices.length || a.displayName.localeCompare(b.displayName));
  }, [systemVoices]);

  const filteredSystemGroups = useMemo(
    () => groupedSystemVoices.map((group) => ({
      ...group,
      voices: normalizedFilter
        ? group.voices.filter(
          (voice) =>
            voice.name.toLowerCase().includes(normalizedFilter) ||
            voice.voiceId.toLowerCase().includes(normalizedFilter) ||
            (voice.language ?? '').toLowerCase().includes(normalizedFilter)
        )
        : group.voices,
    })),
    [groupedSystemVoices, normalizedFilter]
  );

  const hasFilteredSystemVoices = filteredSystemGroups.some((group) => group.voices.length > 0);

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)">
      <AreaHeader
        title="Voice gallery"
        description="Browse system voices and manage voices you have saved."
        actions={
          <Box display="flex" gap={2}>
            <Button variant="outline" onClick={loadVoices} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <ScreenResetButton namespace="voices" disabled={isLoading} onReset={() => void loadVoices()} />
          </Box>
        }
      />

      {error && <ErrorDisplay code={error.code} message={error.message} />}
      {actionStatus && !error && (
        <Box bg="state.okSoft" borderRadius="md" px="14px" py="12px" color="content.ink" fontSize="label">
          {actionStatus}
        </Box>
      )}

      <Sheet>
        <SheetHeader icon="speech">
          <SheetTitle>Voices</SheetTitle>
          <SheetDescription>Search your catalog or browse by language.</SheetDescription>
        </SheetHeader>
        <SheetContent>
          <Tabs defaultValue="system">
            <TabsList>
              <TabsTrigger value="system">System voices</TabsTrigger>
              <TabsTrigger value="user">My voices ({userVoices.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="system">
              <Box display="grid" gap="16px" mt="12px">
                <Box maxW="24rem">
                  <Input
                    placeholder="Search by name or voice ID"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </Box>
                <Box display="grid" gap="24px" gridTemplateColumns="minmax(0, 1fr)">
                  {filteredSystemGroups.filter((group) => group.voices.length > 0).map((group) => (
                    <VoiceGroupSection key={group.language} language={group.language} voices={group.voices} />
                  ))}
                  {!hasFilteredSystemVoices && (
                    <p style={{ color: 'var(--chakra-colors-content-readout)', fontSize: '0.9375rem' }}>
                      {filter ? 'No matching system voices.' : 'No system voices available.'}
                    </p>
                  )}
                </Box>
              </Box>
            </TabsContent>

            <TabsContent value="user">
              <Box display="grid" gap="16px" mt="12px">
                <Box maxW="24rem">
                  <Input
                    placeholder="Search by name or voice ID"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </Box>
                <Box display="grid" gap="12px" gridTemplateColumns="minmax(0, 1fr)">
                  {filteredUserVoices.map((voice) => (
                    <VoiceCard
                      key={voice.voiceId}
                      voice={voice}
                      onDelete={setPendingDeleteVoice}
                      isDeleting={deletingId === voice.voiceId}
                    />
                  ))}
                  {filteredUserVoices.length === 0 && (
                    <Box bg="surface.inset" border="1px solid" borderColor="surface.separator" borderRadius="md" p="20px">
                      <Box fontWeight={700} color="content.ink">
                        {filter ? 'No matching my voices' : 'No saved voices yet'}
                      </Box>
                      <Box color="content.readout" fontSize="0.9375rem" lineHeight="1.4" mt="4px">
                        {filter
                          ? 'Clear the filter to see all cloned and designed voices.'
                          : 'Clone a voice from an audio sample or design one from a prompt, then use it in Text to Speech.'}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>


      <ConfirmationDialog
        open={pendingDeleteVoice !== null}
        onOpenChange={(open) => !open && setPendingDeleteVoice(null)}
        title="Delete voice?"
        description={`Delete ${pendingDeleteVoice?.voiceId ?? 'this voice'} from MiniMax? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        loading={deletingId !== null}
      />
    </Box>
  );
}
