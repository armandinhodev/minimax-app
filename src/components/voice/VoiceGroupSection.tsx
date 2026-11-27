import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { VoiceCard } from '@/components/voice/VoiceCard';
import type { VoiceDTO } from '@/application/dto/minimax/speech/VoiceDTO';
import { FLAG_SIZE_HEADER, getFlagUrl, getLanguageInfo } from '@/lib/language-flags';

interface VoiceGroupSectionProps {
  language: string;
  voices: VoiceDTO[];
  onDelete?: (voice: VoiceDTO) => void;
  deletingId?: string | null;
}

export function VoiceGroupSection({ language, voices, onDelete, deletingId }: VoiceGroupSectionProps) {
  const info = getLanguageInfo(language);
  const flagUrl = info.countryCode ? getFlagUrl(info.countryCode, FLAG_SIZE_HEADER) : null;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Box display="grid" gap="10px" gridTemplateColumns="minmax(0, 1fr)">
      <Box display="flex" alignItems="center" gap="8px">
        {flagUrl && !imgFailed ? (
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
        )}
        <Box fontSize="subtitle" fontWeight={700}>
          {info.displayName}
        </Box>
        <Box color="content.readout" fontSize="help">
          ({voices.length})
        </Box>
      </Box>

      <Box display="grid">
        {voices.map((voice) => (
          <VoiceCard key={voice.voiceId} voice={voice} onDelete={onDelete} isDeleting={deletingId === voice.voiceId} />
        ))}
        {voices.length === 0 && (
          <p style={{ color: 'var(--chakra-colors-content-readout)', fontSize: '0.875rem' }}>
            No voices in this group match the current filter.
          </p>
        )}
      </Box>
    </Box>
  );
}
