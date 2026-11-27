'use client';

/**
 * App shell layout — wraps all authenticated (app) routes.
 * Renders the studio sidebar and applies AppKeyGate.
 * AppKeyGate redirects to /login if no key is in sessionStorage.
 */

import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { MobileTopBar, Sidebar } from '@/components/navigation/Sidebar';
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
        <Box display={{ base: 'block', lg: 'none' }}>
          <MobileTopBar onOpenMenu={openMenu} isOpen={isMobileMenuOpen} />
        </Box>
        <MobileNavDrawer isOpen={isMobileMenuOpen} onClose={closeMenu} />

        <Box display="flex" minH="100vh">
          <Box display={{ base: 'none', lg: 'block' }}>
            <Sidebar />
          </Box>

          {/* minW=0: sin esto el contenido ancho empuja el shell y la
              pagina desborda en horizontal en vez de encogerse. */}
          <Box
            as="main"
            flex={1}
            minW={0}
            px={{ base: '18px', md: '32px' }}
            py={{ base: '20px', md: '32px' }}
            width="100%"
          >
            <Box maxW={isWideContent ? 'none' : '72rem'} mx="auto" width="100%" minW={0}>
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </AppKeyGate>
  );
}
