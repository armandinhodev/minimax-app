"use client";

function Switch({ checked, onChange, className, disabled, id, ariaLabel }: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked);
  };

  return (
    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }} className={className}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        style={{
          position: "absolute",
          opacity: 0,
          width: "100%",
          height: "100%",
          cursor: disabled ? "not-allowed" : "pointer",
          margin: 0,
        }}
      />
      <div
        style={{
          width: "2rem",
          height: "1.15rem",
          borderRadius: "9999px",
          background: checked ? "var(--chakra-colors-interaction-accent)" : "var(--chakra-colors-surface-rule)",
          position: "relative",
          transition: "background-color 0.2s",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div
          style={{
            content: '""',
            position: "absolute",
            top: "2px",
            left: checked ? "calc(100% - 14px)" : "2px",
            width: "14px",
            height: "14px",
            borderRadius: "9999px",
            background: "var(--chakra-colors-surface-sheet)",
            transition: "left 0.2s",
            boxShadow: "var(--chakra-shadows-sm)",
          }}
        />
      </div>
    </label>
  );
}

export { Switch };
