"use client";

/**
 * The mobile navigation sheet.
 *
 * Below the transport breakpoint the areas move into a drawer. It lists every
 * area and every route, because the transport no longer can. It traps focus
 * while it is open and gives it back to the trigger when it closes.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { clearAppAccessKey } from "@/components/shared/AppKeyGate";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAV_SECTIONS, isNavItemActive, matchesPath } from "./nav-config";
import styles from "./navigation.module.css";

export const MOBILE_NAV_DRAWER_ID = "mobile-navigation-drawer";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogout = () => {
    clearAppAccessKey();
    window.location.href = "/login";
  };

  return (
    <div className={styles.drawerRoot} data-testid="mobile-nav-drawer">
      <button
        type="button"
        className={styles.drawerOverlay}
        onClick={onClose}
        aria-label="Close navigation menu"
      />
      <div
        id={MOBILE_NAV_DRAWER_ID}
        ref={panelRef}
        className={styles.drawerPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Navigation</span>
          <Button type="button" variant="transport" size="sm" onClick={onClose} aria-label="Close navigation menu">
            Close
          </Button>
        </div>

        <nav aria-label="Product areas" className={styles.drawerNav}>
          {PRODUCT_NAV_SECTIONS.map((section) => {
            const isAreaActive = matchesPath(pathname, section.matchPaths);
            const items = section.groups.flatMap((group) => group.items);

            return (
              <section key={section.id} className={styles.drawerSection} data-section={section.id} data-active={isAreaActive ? "true" : "false"}>
                <Link
                  href={section.href}
                  className={styles.drawerSectionLink}
                  onClick={onClose}
                  aria-current={isAreaActive ? "true" : undefined}
                >
                  {section.label}
                </Link>
                {items.length > 0 && (
                  <ul className={styles.drawerLinks}>
                    {items.map((item) => {
                      const isActive = isNavItemActive(pathname, item);

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={styles.drawerLink}
                            onClick={onClose}
                            data-active={isActive ? "true" : "false"}
                            aria-current={isActive ? "page" : undefined}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </nav>

        <div className={styles.drawerFooter}>
          <Button type="button" variant="transport" size="sm" onClick={handleLogout} width="100%">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
