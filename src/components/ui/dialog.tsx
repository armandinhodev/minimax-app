"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

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
