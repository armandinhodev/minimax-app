'use client';

/**
 * App shell layout — wraps all authenticated (app) routes.
 * Renders the authenticated product shell and applies AppKeyGate.
 * AppKeyGate redirects to /login if no key is in sessionStorage.
 */

import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { AreaSubnav } from '@/components/navigation/AreaSubnav';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { TransportNav } from '@/components/navigation/TransportNav';
import { WIDE_CONTENT_MATCH_PATHS, matchesPath } from '@/components/navigation/nav-config';
import { AppKeyGate } from '@/components/shared/AppKeyGate';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isWideContent = matchesPath(pathname, WIDE_CONTENT_MATCH_PATHS);

  const openMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  return (
    <AppKeyGate>
      <Box minH="100vh" backgroundColor="surface.field">
        <TransportNav onOpenMenu={openMenu} isMenuOpen={isMobileMenuOpen} />
        <MobileNavDrawer isOpen={isMobileMenuOpen} onClose={closeMenu} />
        <AreaSubnav />
        {/* minW=0: sin esto el contenido ancho empuja el shell y la
            pagina desborda en horizontal en vez de encogerse. */}
        <Box as="main" px={{ base: 4, md: 8 }} py={{ base: 5, md: 7 }} width="100%">
          <Box maxW={isWideContent ? 'none' : '72rem'} mx="auto" width="100%" minW={0}>
            {children}
          </Box>
        </Box>
      </Box>
    </AppKeyGate>
  );
}
