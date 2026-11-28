'use client';

/**
 * MediaReferenceField — one image reference, with an explicit way to provide it.
 *
 * Choose a public URL, upload or paste an image, or pick one already in MiniMax.
 * Multi-reference fields append instead of replacing.
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { getMediaReferenceLabel, joinMediaReferences, splitMediaReferences } from '@/lib/media-references';

import { MediaReferenceActions, type MediaUploadPurpose } from './MediaReferenceActions';
import { MediaReferencePreview } from './MediaReferencePreview';

type Method = 'url' | 'paste' | 'upload';

const METHODS: Array<{ value: Method; label: string }> = [
  { value: 'url', label: 'URL' },
  { value: 'paste', label: 'Paste image' },
  { value: 'upload', label: 'Upload' },
];

interface MediaReferenceFieldProps {
  purpose: MediaUploadPurpose;
  /** What the reference is used as, e.g. "reference image". */
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Renders a comma separated list instead of a single value. */
  multiple?: boolean;
  maxItems?: number;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  onMediaError?: (message: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function initialMethod(value: string): Method {
  // A stored mm_file reference keeps its attachment row and preview (when the
  // original is still in tab memory) but offers no library picker.
  return value.startsWith('mm_file://') ? 'upload' : 'url';
}

export function MediaReferenceField({
  purpose,
  label,
  value,
  onChange,
  multiple = false,
  maxItems,
  id,
  disabled = false,
  required = false,
  placeholder,
  hint,
  onMediaError,
}: MediaReferenceFieldProps) {
  const [method, setMethod] = useState<Method>(() => initialMethod(value));
  const references = splitMediaReferences(value);
  const isFull = multiple && maxItems !== undefined && references.length >= maxItems;

  const applyReference = (reference: string) => {
    if (!multiple) {
      onChange(reference);
      return;
    }

    if (references.includes(reference)) return;

    if (isFull) {
      onMediaError?.(`You can attach at most ${maxItems} images.`);
      return;
    }

    onChange(joinMediaReferences([...references, reference]));
  };

  const removeReference = (reference: string) => {
    onChange(joinMediaReferences(references.filter((current) => current !== reference)));
  };

  return (
    <Box display="grid" gap="8px">
      <Box role="group" aria-label={`Choose how to add the ${label}`} aria-required={required || undefined} display="flex" gap="6px" flexWrap="wrap">
        {METHODS.map((option) => (
          <Chip
            key={option.value}
            selected={method === option.value}
            disabled={disabled}
            onClick={() => setMethod(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </Box>

      {method === 'url' && (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}

      {method !== 'url' && (
        <MediaReferenceActions
          key={method === 'paste' ? 'paste' : 'files'}
          method={method}
          purpose={purpose}
          label={label}
          disabled={disabled}
          pasteLimitReached={isFull}
          onUse={({ reference }) => applyReference(reference)}
        />
      )}

      {references.length > 0 && (
        <Box as="ul" display="grid" gap="6px" m={0} p={0} listStyle="none" aria-label={`${label} attached`}>
          {references.map((reference, index) => {
            const meta = getMediaReferenceLabel(reference);

            return (
              <Box
                as="li"
                key={`${reference}-${index}`}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="10px"
                border="1px solid"
                borderColor="surface.separator"
                borderRadius="md"
                px="10px"
                py="6px"
              >
                <MediaReferencePreview reference={reference} alt={`Preview of ${label}${multiple ? ` ${index + 1}` : ''}`} />
                <Box display="grid" gap="2px" flex="1" minW={0}>
                  <Box color="content.ink" fontSize="sm" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                    {multiple ? `${index + 1}. ` : ''}
                    {meta?.fileName ?? (/^data:image\//i.test(reference) ? 'Inline image' : reference)}
                  </Box>
                  {meta?.size != null && (
                    <Box color="content.subtle" fontSize="help">{formatBytes(meta.size)}</Box>
                  )}
                </Box>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={disabled}
                  aria-label={multiple ? `Remove ${label} ${index + 1}` : `Remove ${label}`}
                  onClick={() => removeReference(reference)}
                >
                  Remove
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      {hint && (
        <Box color="content.subtle" fontSize="label" lineHeight="label">
          {hint}
        </Box>
      )}
    </Box>
  );
}
