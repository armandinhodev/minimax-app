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
        placeItems: 'center',
        background: 'var(--chakra-colors-surface-field)',
        padding: '18px',
      }}
    >
      <Box
        width="100%"
        maxW="416px"
        bg="surface.plate"
        border="1px solid"
        borderColor="surface.separator"
        borderRadius="lg"
        overflow="hidden"
      >
        <Box h="4px" bg="transport.bg" />
        <Box p={{ base: '24px', md: '28px' }} display="grid" gap="16px">
          <Box
            aria-hidden="true"
            fontFamily="body"
            fontSize="1.5rem"
            fontWeight={700}
            letterSpacing="-0.12em"
            lineHeight={1}
            color="interaction.accent"
          >
            ///
          </Box>

          <Box
            as="h1"
            fontSize={{ base: '2.125rem', md: '2.875rem' }}
            lineHeight="display"
            fontWeight={700}
            letterSpacing="-0.039em"
            color="content.ink"
          >
            MiniMax Studio
          </Box>

          <Box color="content.readout" fontSize="body" lineHeight="body">
            Enter your studio access key to continue.
          </Box>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', width: '100%' }}>
            <label
              htmlFor="access-key"
              style={{
                fontSize: 'var(--chakra-font-sizes-label)',
                lineHeight: 'var(--chakra-line-heights-label)',
                fontWeight: 700,
                color: 'var(--chakra-colors-content-ink)',
              }}
            >
              Access key
              <span aria-hidden="true" style={{ color: 'var(--chakra-colors-content-readout)' }}>
                {' *'}
              </span>
            </label>
            <Input
              id="access-key"
              type="password"
              placeholder="Enter your access key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              autoFocus
              disabled={isLoading}
              required
              aria-required="true"
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Validating...' : 'Sign in'}
            </Button>

            <Box color="content.readout" fontSize="help" lineHeight="help">
              Fields marked * are required.
            </Box>
          </form>
        </Box>
      </Box>
    </main>
  );
}
