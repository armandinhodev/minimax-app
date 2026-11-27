"use client";

/**
 * The transport: the app's top bar.
 *
 * One ink strip across the top holds the eight areas and the session, so the
 * work width goes to the bench. It replaces the old graphite side rail.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clearAppAccessKey } from "@/components/shared/AppKeyGate";
import { Button } from "@/components/ui/button";
import { MOBILE_NAV_DRAWER_ID } from "./MobileNavDrawer";
import { PRODUCT_NAV_SECTIONS, matchesPath } from "./nav-config";
import styles from "./navigation.module.css";

export function activeSection(pathname: string) {
  return PRODUCT_NAV_SECTIONS.find((section) => matchesPath(pathname, section.matchPaths));
}

interface TransportNavProps {
  onOpenMenu: () => void;
  isMenuOpen?: boolean;
}

export function TransportNav({ onOpenMenu, isMenuOpen = false }: TransportNavProps) {
  const pathname = usePathname();
  const current = activeSection(pathname);

  const handleLogout = () => {
    clearAppAccessKey();
    window.location.href = "/login";
  };

  return (
    <header className={styles.transport}>
      <Link href="/tts" className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span>MiniMax Studio</span>
      </Link>

      <nav aria-label="Product areas" className={styles.areaNav}>
        {PRODUCT_NAV_SECTIONS.map((section) => {
          const isActive = current?.id === section.id;

          return (
            <Link
              key={section.id}
              href={section.href}
              className={styles.areaLink}
              data-section={section.id}
              data-active={isActive ? "true" : "false"}
              aria-current={isActive ? "true" : undefined}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.transportSession}>
        <Button type="button" variant="transport" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>

      <Button
        type="button"
        variant="transport"
        size="sm"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-expanded={isMenuOpen}
        aria-controls={MOBILE_NAV_DRAWER_ID}
        className={styles.menuButton}
      >
        Menu
      </Button>
    </header>
  );
}
