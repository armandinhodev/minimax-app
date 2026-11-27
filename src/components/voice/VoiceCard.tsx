'use client';

/**
 * VoiceCard — one voice.
 *
 * System voices are rows: icon, name and id, type, and the way into TTS.
 * Saved voices are cards: name, type, the production facts and the actions.
 */

import Link from 'next/link';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icons';
import { Spec } from '@/components/ui/spec';
import { TTLCounter } from '@/components/shared/TTLCounter';
import type { VoiceDTO } from '@/application/dto/minimax/speech/VoiceDTO';

interface VoiceCardProps {
  voice: VoiceDTO;
  onUse?: (voiceId: string) => void;
  onDelete?: (voice: VoiceDTO) => void;
  isDeleting?: boolean;
}

function typeLabel(type: VoiceDTO['type']): string {
  if (type === 'clone') return 'Cloned';
  if (type === 'design') return 'Designed';
  return 'System';
}

function typeVariant(type: VoiceDTO['type']): 'subtle' | 'success' | 'secondary' {
  if (type === 'clone') return 'secondary';
  if (type === 'design') return 'success';
  return 'subtle';
}

const outlineLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "36px",
  padding: "0 14px",
  border: "1px solid var(--chakra-colors-surface-rule)",
  borderRadius: "var(--chakra-radii-md)",
  background: "var(--chakra-colors-surface-plate)",
  color: "var(--chakra-colors-content-ink)",
  fontSize: "var(--chakra-font-sizes-label)",
  fontWeight: 700,
  textDecoration: "none",
};

export function VoiceCard({ voice, onUse, onDelete, isDeleting = false }: VoiceCardProps) {
  const createdDate = new Date(voice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (voice.type === 'system') {
    return (
      <Box
        display="grid"
        gridTemplateColumns="36px minmax(0, 1fr) auto auto"
        gap="12px"
        alignItems="center"
        py="10px"
        borderBottom="1px solid"
        borderColor="surface.separator"
      >
        <Box
          aria-hidden="true"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="36px"
          h="36px"
          bg="surface.inset"
          border="1px solid"
          borderColor="surface.separator"
          borderRadius="md"
          color="content.readout"
        >
          <Icon name="wave" size={18} />
        </Box>
        <Box minW={0}>
          <Box fontWeight={700} fontSize="body" lineHeight="1.3" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {voice.name}
          </Box>
          <Box fontFamily="mono" fontSize="help" lineHeight="help" color="content.readout" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {voice.voiceId}
          </Box>
        </Box>
        <Badge variant={typeVariant(voice.type)}>{typeLabel(voice.type)}</Badge>
        {onUse ? (
          <Button variant="outline" size="sm" onClick={() => onUse(voice.voiceId)}>
            Use in TTS
          </Button>
        ) : (
          <Link href="/tts" style={outlineLink}>
            Use in TTS
          </Link>
        )}
      </Box>
    );
  }

  return (
    <Box border="1px solid" borderColor="surface.separator" borderRadius="md" p="16px" display="grid" gap="12px">
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={3}>
        <Box minW={0}>
          <Box fontSize="subtitle" lineHeight="subtitle" fontWeight={700} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {voice.name}
          </Box>
          <Box fontFamily="mono" fontSize="help" lineHeight="help" color="content.readout" mt="2px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {voice.voiceId}
          </Box>
        </Box>
        <Badge variant={typeVariant(voice.type)}>{typeLabel(voice.type)}</Badge>
      </Box>

      <Box>
        <Spec label="Created" value={createdDate} />
        {voice.ttlExpiry && (
          <Spec label="Expires in" value={<TTLCounter expiresAt={voice.ttlExpiry} label="TTL" />} />
        )}
      </Box>

      <Box display="flex" gap="8px" flexWrap="wrap">
        {onUse ? (
          <Button variant="outline" onClick={() => onUse(voice.voiceId)} disabled={isDeleting}>
            Use in TTS
          </Button>
        ) : (
          <Link href="/tts" style={outlineLink}>
            Use in TTS
          </Link>
        )}
        {onDelete && (
          <Button variant="destructive" onClick={() => onDelete(voice)} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
