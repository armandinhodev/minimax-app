"use client";

/**
 * The sidebar: the studio index.
 *
 * Slate ground, eight areas in a stable order, the active area expanded with
 * its routes. The current route carries the copper-soft ground, a 2px left
 * mark and aria-current. Sign out sits at the foot.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clearAppAccessKey } from "@/components/shared/AppKeyGate";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { PRODUCT_NAV_SECTIONS, isNavItemActive, matchesPath, type ProductAccent } from "./nav-config";
import styles from "./navigation.module.css";

export const AREA_ICONS: Record<ProductAccent, IconName> = {
  speech: "speech",
  text: "chat",
  image: "image",
  music: "music",
  video: "video",
  "video-agent": "video-agent",
  library: "library",
};

export function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="MiniMax Studio, go to the overview">
      <span className={styles.brandMark} aria-hidden="true">
        ///
      </span>
      <span>MiniMax Studio</span>
    </Link>
  );
}

export function SignOutButton() {
  const handleLogout = () => {
    clearAppAccessKey();
    window.location.href = "/login";
  };

  return (
    <button type="button" className={styles.signOut} onClick={handleLogout}>
      Sign out
    </button>
  );
}

export function StudioNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Product areas" className={styles.nav}>
      <Link
        href="/"
        className={styles.overviewLink}
        onClick={onNavigate}
        data-active={pathname === "/" ? "true" : "false"}
        aria-current={pathname === "/" ? "page" : undefined}
      >
        <Icon name="overview" />
        <span>Overview</span>
      </Link>

      <div className={styles.navRule} aria-hidden="true" />

      {PRODUCT_NAV_SECTIONS.map((section) => {
        const isActive = matchesPath(pathname, section.matchPaths);
        const items = section.groups.flatMap((group) => group.items);
        const hasRoutes = items.length > 1;
        const isLandingCurrent = pathname === section.href && !hasRoutes;

        return (
          <div key={section.id} className={styles.section} data-section={section.id} data-active={isActive ? "true" : "false"}>
            <Link
              href={section.href}
              className={styles.areaLink}
              onClick={onNavigate}
              data-active={isActive ? "true" : "false"}
              data-leaf={hasRoutes ? "false" : "true"}
              aria-current={isLandingCurrent ? "page" : undefined}
            >
              <Icon name={AREA_ICONS[section.id]} />
              <span className={styles.areaLabel}>{section.label}</span>
              {hasRoutes && (
                <Icon
                  name="chevron-down"
                  size={14}
                  className={`${styles.chevron} ${isActive ? styles.chevronOpen : ""}`}
                />
              )}
            </Link>

            {hasRoutes && isActive && (
              <ul className={styles.routes}>
                {items.map((item) => {
                  const isCurrent = isNavItemActive(pathname, item);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={styles.routeLink}
                        onClick={onNavigate}
                        data-active={isCurrent ? "true" : "false"}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className={`${styles.sidebar} ${styles.sidebarDesktop}`}>
      <Brand />
      <StudioNav />
      <div className={styles.sidebarFooter}>
        <SignOutButton />
      </div>
    </aside>
  );
}

export function MobileTopBar({ onOpenMenu, isOpen }: { onOpenMenu: () => void; isOpen: boolean }) {
  return (
    <header className={styles.mobileBar}>
      <Button
        type="button"
        variant="transport"
        size="sm"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-drawer"
      >
        <Icon name="menu" size={16} />
        Menu
      </Button>
      <Brand />
    </header>
  );
}
