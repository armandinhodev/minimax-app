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
          {/* minW=0: sin esto el contenido ancho empuja el shell y la
              pagina desborda en horizontal en vez de encogerse.
              El tope es explicito: el token container.xl no resuelve en
              este tema y dejaba las hojas estiradas a lo ancho de la
              pantalla. */}
          <Box as="main" flex={1} minW={0} px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }} width="100%">
            <Box maxW={isWideContent ? 'none' : '72rem'} mx="auto" width="100%" minW={0}>
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </AppKeyGate>
  );
}
