'use client';

/**
 * Login page — app access key entry.
 * POSTs the entered key to /api/auth/validate.
 * Stores key in sessionStorage on 200, redirects to /tts.
 * Shows inline error on failure.
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { setAppAccessKey } from '@/components/shared/AppKeyGate';
import { validateAppAccessKey } from '@/lib/auth-client';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter an access key.');
      return;
    }

    setIsLoading(true);

    try {
      const valid = await validateAppAccessKey(trimmed);

      if (valid) {
        setAppAccessKey(trimmed);
        window.location.href = '/tts';
      } else {
        setError('Invalid access key. Please check and try again.');
      }
    } catch {
      setError('Unable to validate key. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        background: 'var(--chakra-colors-surface-field)',
      }}
    >
      <Box
        display="grid"
        alignContent="center"
        justifyItems="start"
        px={{ base: 6, md: 12 }}
        py={{ base: 10, md: 16 }}
        width="100%"
        maxW="34rem"
        marginInline="auto"
      >
        <Box display="flex" alignItems="center" gap={3} mb={8}>
          <Box aria-hidden="true" w="0.625rem" h="0.625rem" flex="0 0 auto" bg="interaction.accent" />
          <Box
            fontSize="display"
            lineHeight="display"
            fontWeight="600"
            letterSpacing="-0.02em"
            color="content.ink"
          >
            MiniMax Studio
          </Box>
        </Box>

        <Box color="content.readout" fontSize="body" lineHeight="body" mb={8} maxW="28rem">
          Enter your app access key to continue. Speech, image, video, music and chat all run
          against their own MiniMax endpoint.
        </Box>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', width: '100%' }}>
          <label
            htmlFor="access-key"
            style={{
              fontSize: 'var(--chakra-font-sizes-label)',
              lineHeight: 'var(--chakra-line-heights-label)',
              fontWeight: 500,
              color: 'var(--chakra-colors-content-readout)',
            }}
          >
            Access key
          </label>
          <Input
            id="access-key"
            type="password"
            placeholder="Enter your app access key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoFocus
            disabled={isLoading}
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} justifySelf="start" mt={2}>
            {isLoading ? 'Validating...' : 'Sign in'}
          </Button>
        </form>
      </Box>
    </main>
  );
}
