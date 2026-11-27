"use client";

import { Button } from "@/components/ui/button";

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

function DialogContent({ onClose, children, className }: {
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{
        background: "var(--chakra-colors-surface-plate)",
        borderRadius: "var(--chakra-radii-xl)",
        padding: "1.25rem",
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
        onClick={onClose}
        aria-label="Close dialog"
        style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}
      >
        Close
      </Button>
    </div>
  );
}

function DialogHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }} className={className}>
      {children}
    </div>
  );
}

function DialogFooter({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}
      className={className}
    >
      {children}
    </div>
  );
}

function DialogTitle({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }} className={className}>
      {children}
    </h2>
  );
}

function DialogDescription({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--chakra-colors-content-readout)" }} className={className}>
      {children}
    </p>
  );
}

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
