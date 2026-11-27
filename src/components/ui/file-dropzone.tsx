"use client";

/**
 * FileDropzone — the studio's file picker.
 *
 * A dashed target that opens the native picker with a click or a key, accepts
 * a drop, and names the chosen file. The input is the real control; the label
 * is its surface.
 */

import { useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

import { Icon } from "@/components/ui/icons";

interface FileDropzoneProps {
  id?: string;
  accept?: string;
  file?: File | null;
  hint?: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}

export function FileDropzone({ id, accept, file, hint, disabled = false, onFile }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (next: File | undefined) => {
    if (next) onFile(next);
  };

  return (
    <Box
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files?.[0]);
      }}
      display="grid"
      gap="4px"
      justifyItems="center"
      textAlign="center"
      px="20px"
      py="18px"
      border="1px dashed"
      borderColor={dragging ? "interaction.accent" : "surface.rule"}
      borderRadius="md"
      bg={dragging ? "interaction.faint" : "surface.plate"}
      color="content.ink"
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.6 : 1}
      _focusWithin={{ outline: "3px solid var(--chakra-colors-interaction-accent)", outlineOffset: "2px" }}
    >
      <label style={{ display: "contents" }}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => pick(event.currentTarget.files?.[0] ?? undefined)}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />

      <Box display="inline-flex" alignItems="center" gap="8px" fontSize="label" lineHeight="label">
        <Icon name="file" size={16} />
        <Box as="span" fontWeight={700}>
          Choose file
        </Box>
        <Box as="span" color="content.readout">
          or drop it here
        </Box>
      </Box>

      {file ? (
        <Box fontFamily="mono" fontSize="help" color="content.ink" overflow="hidden" textOverflow="ellipsis" maxW="100%">
          {file.name}
        </Box>
      ) : (
        <Box fontSize="help" color="content.readout">
          {hint ?? "Accepted formats depend on the field."}
        </Box>
      )}
      </label>
    </Box>
  );
}
