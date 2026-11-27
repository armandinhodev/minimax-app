'use client';

/**
 * VoiceCard — voice card with TTL countdown badge.
 * Shows voice name, ID, type badge, TTL countdown (if ttlExpiry set),
 * and supports use-in-T2A and delete actions.
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { TTLCounter } from '@/components/shared/TTLCounter';
import type { VoiceDTO } from '@/application/dto/minimax/speech/VoiceDTO';
import { FLAG_SIZE_CARD, getFlagUrl, getLanguageInfo } from '@/lib/language-flags';

interface VoiceCardProps {
  voice: VoiceDTO;
  onUse?: (voiceId: string) => void;
  onDelete?: (voice: VoiceDTO) => void;
  isDeleting?: boolean;
}

function VoiceTypeBadge({ type }: { type: VoiceDTO['type'] }) {
  const variants: Record<VoiceDTO['type'], 'info' | 'purple' | 'success'> = {
    system: 'info',
    clone: 'purple',
    design: 'success',
  };
  const labels: Record<VoiceDTO['type'], string> = {
    system: 'System',
    clone: 'Cloned',
    design: 'Designed',
  };
  return <Badge variant={variants[type]}>{labels[type]}</Badge>;
}

export function VoiceCard({ voice, onUse, onDelete, isDeleting = false }: VoiceCardProps) {
  const createdDate = new Date(voice.createdAt).toLocaleDateString();
  const info = voice.language ? getLanguageInfo(voice.language) : null;
  const flagUrl = info?.countryCode ? getFlagUrl(info.countryCode, FLAG_SIZE_CARD) : null;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Sheet>
      <SheetHeader>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box minW={0} flex={1}>
            <Box display="flex" alignItems="center" gap={1} minW={0}>
              {voice.type === 'system' && info && (
                flagUrl && !imgFailed ? (
                  <img
                    src={flagUrl}
                    width={20}
                    height={15}
                    alt={info.displayName}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImgFailed(true)}
                    style={{ display: 'block' }}
                  />
                ) : (
                  <span style={{ fontSize: '1rem' }} aria-label={info.displayName}>
                    {info.fallbackEmoji}
                  </span>
                )
              )}
              <SheetTitle style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voice.name}</SheetTitle>
            </Box>
            <SheetDescription style={{ fontSize: '0.75rem', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={voice.voiceId}>
              {voice.voiceId}
            </SheetDescription>
          </Box>
          <VoiceTypeBadge type={voice.type} />
        </Box>
      </SheetHeader>
      <SheetContent display="flex" flexDirection="column" gap={2}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Badge variant={voice.type === 'system' ? 'secondary' : 'success'}>
            {voice.type === 'system' ? 'System voice' : 'My voice'}
          </Badge>
          <span style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-content-readout)' }}>Created {createdDate}</span>
          {voice.ttlExpiry && <TTLCounter expiresAt={voice.ttlExpiry} label="TTL" />}
        </Box>
        <Box display="flex" gap={1} style={{ marginTop: '0.25rem' }}>
          {onUse && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUse(voice.voiceId)}
              disabled={isDeleting}
            >
              Use in TTS
            </Button>
          )}
          {voice.type !== 'system' && onDelete && (
            <Button
              variant="outline"
              colorPalette="red"
              size="sm"
              onClick={() => onDelete(voice)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </Box>
      </SheetContent>
    </Sheet>
  );
}
