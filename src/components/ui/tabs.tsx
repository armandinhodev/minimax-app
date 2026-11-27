"use client";

import { createContext, useContext, useState } from "react";
import { Box } from "@chakra-ui/react";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  children?: React.ReactNode;
  className?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({ children, className, defaultValue = "", value: controlledValue, onValueChange }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <Box display="flex" flexDirection="column" gap="0.75rem" className={className}>
        {children}
      </Box>
    </TabsContext.Provider>
  );
}

/** Arrow keys move between tabs, the way a tablist is expected to behave. */
function handleTabKeys(event: React.KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;

  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  if (tabs.length === 0) return;

  const current = tabs.findIndex((tab) => tab === document.activeElement);
  if (current === -1) return;

  event.preventDefault();
  let next = current;
  if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
  if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = tabs.length - 1;

  tabs[next]?.focus();
}

function TabsList({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <Box
      role="tablist"
      onKeyDown={handleTabKeys}
      display="flex"
      alignItems="center"
      width="100%"
      borderBottom="1px solid"
      borderColor="surface.rule"
      gap="0.25rem"
      className={className}
    >
      {children}
    </Box>
  );
}

function TabsTrigger({ children, className, value }: { children?: React.ReactNode; className?: string; value?: string }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={value ? `tab-${value}` : undefined}
      aria-selected={isActive}
      aria-controls={value ? `panel-${value}` : undefined}
      tabIndex={isActive ? 0 : -1}
      onClick={() => value && context.onValueChange(value)}
      style={{
        height: "2.25rem",
        paddingLeft: "0.65rem",
        paddingRight: "0.65rem",
        fontSize: "0.875rem",
        fontWeight: isActive ? 600 : 500,
        borderRadius: 0,
        color: isActive ? "var(--chakra-colors-interaction-accent)" : "var(--chakra-colors-content-readout)",
        background: "transparent",
        border: "none",
        borderBottom: isActive ? "2px solid var(--chakra-colors-interaction-accent)" : "2px solid transparent",
        marginBottom: "-1px",
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
      }}
      className={className}
    >
      {children}
    </button>
  );
}

function TabsContent({ children, className, value, style }: { children?: React.ReactNode; className?: string; value?: string; style?: React.CSSProperties }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  if (context.value !== value) return null;

  return (
    <Box
      role="tabpanel"
      id={value ? `panel-${value}` : undefined}
      aria-labelledby={value ? `tab-${value}` : undefined}
      flex="1"
      fontSize="body"
      className={className}
      style={style}
    >
      {children}
    </Box>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
