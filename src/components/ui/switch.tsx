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
    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }} className={className}>
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
          width: "36px",
          height: "20px",
          borderRadius: "9999px",
          background: checked ? "var(--chakra-colors-interaction-accent)" : "var(--chakra-colors-surface-rule)",
          position: "relative",
          transition: "background-color 0.16s",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "9999px",
            background: "var(--chakra-colors-surface-plate)",
            transition: "left 0.16s",
          }}
        />
      </div>
    </label>
  );
}

export { Switch };
