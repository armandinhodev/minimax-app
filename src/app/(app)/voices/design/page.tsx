'use client';

/**
 * Voice design workflow page.
 * Enter a prompt and preview text, generate a preview voice, accept or regenerate.
 * Saved voices have a 168-hour TTL.
 */

import Link from 'next/link';
import { Box } from '@chakra-ui/react';
import { VoiceDesigner } from '@/components/voice/VoiceDesigner';
import { AreaHeader } from '@/components/ui/area-header';

export default function DesignVoicePage() {
  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" maxW="36rem">
      <AreaHeader
        title="Design a Voice"
        description="Describe the voice you want using natural language. Generate a preview and accept or regenerate."
      />

      {/* Voice Designer — Phase 6 component */}
      <VoiceDesigner />

      {/* Saved Voice — shown via VoiceDesigner internal state */}
      <Box display="grid" gap={4} gridTemplateColumns="minmax(0, 1fr)">
        <Link
          href="/tts"
          style={{ display: 'inline-flex', height: '2rem', width: 'fit-content', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', borderRadius: 'var(--chakra-radii-md)', border: '1px solid transparent', backgroundColor: 'var(--chakra-colors-interaction-accent)', padding: '0 0.75rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--chakra-colors-content-inverse)' }}
        >
          Go to Text to Speech
        </Link>
        <Link
          href="/voices"
          style={{ display: 'inline-flex', height: '2rem', width: 'fit-content', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', borderRadius: 'var(--chakra-radii-md)', border: '1px solid var(--chakra-colors-surface-rule)', backgroundColor: 'var(--chakra-colors-surface-sheet)', padding: '0 0.75rem', fontSize: '0.875rem' }}
        >
          View All Voices
        </Link>
      </Box>
    </Box>
  );
}
