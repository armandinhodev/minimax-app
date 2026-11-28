"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(content: HTMLElement | null): HTMLElement[] {
  if (!content) return [];
  return Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled"),
  );
}

function Dialog({ open, onOpenChange, children }: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--chakra-colors-surface-veil)",
          zIndex: 40,
        }}
        onClick={() => onOpenChange?.(false)}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DialogContent({
  onClose,
  children,
  className,
  label,
}: {
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  /** Accessible name of the dialog. */
  label?: string;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    getFocusable(contentRef.current)[0]?.focus();

    return () => previous?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusable(contentRef.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        background: "var(--chakra-colors-surface-plate)",
        border: "1px solid var(--chakra-colors-surface-separator)",
        borderRadius: "var(--chakra-radii-lg)",
        padding: "20px",
        boxShadow: "var(--chakra-shadows-overlay)",
        maxWidth: "100%",
        width: "100%",
        maxHeight: "85vh",
        overflowY: "auto",
        position: "relative",
      }}
      className={className}
    >
      {children}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        style={{ position: "absolute", top: "8px", right: "8px" }}
      >
        <Icon name="close" size={16} />
      </Button>
    </div>
  );
}

function DialogHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }} className={className}>
      {children}
    </div>
  );
}

function DialogFooter({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}
      className={className}
    >
      {children}
    </div>
  );
}

function DialogTitle({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <h2 style={{ fontSize: "1.4375rem", fontWeight: 700, lineHeight: 1.26, letterSpacing: "-0.024em" }} className={className}>
      {children}
    </h2>
  );
}

function DialogDescription({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p style={{ fontSize: "1rem", lineHeight: 1.44, color: "var(--chakra-colors-content-readout)" }} className={className}>
      {children}
    </p>
  );
}

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
