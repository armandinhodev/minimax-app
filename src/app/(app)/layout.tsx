'use client';

/**
 * App shell layout — wraps all authenticated (app) routes.
 * Renders the authenticated product shell and applies AppKeyGate.
 * AppKeyGate redirects to /login if no key is in sessionStorage.
 */

import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { MobileNavDrawer, MobileNavHeader } from '@/components/navigation/MobileNavDrawer';
import { WIDE_CONTENT_MATCH_PATHS, matchesPath } from '@/components/navigation/nav-config';
import { AppKeyGate } from '@/components/shared/AppKeyGate';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isWideContent = matchesPath(pathname, WIDE_CONTENT_MATCH_PATHS);

  return (
    <AppKeyGate>
      <Box minH="100vh" backgroundColor="var(--chakra-colors-surface-field)">
        <Box display={{ base: 'block', md: 'none' }}>
          <MobileNavHeader isOpen={isMobileMenuOpen} onOpen={() => setIsMobileMenuOpen(true)} />
        </Box>
        <MobileNavDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <Box display="flex" minH="100vh">
          <Box display={{ base: 'none', md: 'block' }}>
            <AppSidebar markCurrent={!isMobileMenuOpen} />
          </Box>
          <Box as="main" flex={1} px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }} width="100%">
            <Box maxW={isWideContent ? 'none' : 'container.xl'} mx="auto" width="100%">
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </AppKeyGate>
  );
}
