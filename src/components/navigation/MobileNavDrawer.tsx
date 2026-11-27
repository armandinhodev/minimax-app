"use client";

/**
 * The mobile navigation drawer.
 *
 * The same studio index as the sidebar, opened from the dark bar. It traps
 * focus while open and restores it to the trigger when it closes.
 */

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Brand, SignOutButton, StudioNav } from "./Sidebar";
import styles from "./navigation.module.css";

export const MOBILE_NAV_DRAWER_ID = "mobile-navigation-drawer";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('button[aria-label="Close navigation menu"]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
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
          <Brand />
          <Button type="button" variant="transport" size="sm" onClick={onClose} aria-label="Close navigation menu">
            <Icon name="close" size={16} />
          </Button>
        </div>

        <StudioNav onNavigate={onClose} />

        <div className={styles.drawerFooter}>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
