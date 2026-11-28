'use client';

/**
 * ScreenResetButton — clears the persisted state of one screen.
 *
 * State now outlives the page, so a composition needs a visible way back to
 * its initial state. The label says what is cleared ("Reset", "New chat").
 */

import { Button } from '@/components/ui/button';
import { resetScreen } from '@/components/shared/screen-state';

interface ScreenResetButtonProps {
  namespace: string;
  /** Other stores this screen owns (for example its uploader). */
  extraNamespaces?: string[];
  label?: string;
  /** Close transient UI or refetch after the persisted state is gone. */
  onReset?: () => void;
  disabled?: boolean;
}

export function ScreenResetButton({ namespace, extraNamespaces = [], label = 'Reset', onReset, disabled = false }: ScreenResetButtonProps) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={() => {
        resetScreen(namespace);
        for (const extra of extraNamespaces) resetScreen(extra);
        onReset?.();
      }}
    >
      {label}
    </Button>
  );
}
