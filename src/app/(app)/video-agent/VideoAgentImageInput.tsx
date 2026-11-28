'use client';

import { useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import { MediaReferencePreview } from '@/components/media/MediaReferencePreview';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';

import { normalizeVideoAgentImage } from './video-agent-image';

const ID = 'video-agent-media';
const SINGLE_METHODS = ['URL', 'Paste image', 'Upload'] as const;
const MULTI_METHODS = ['Paste image', 'Upload'] as const;

interface Props {
  /** Exact number of images the template needs. */
  mediaCount: number;
  url: string;
  files: File[];
  urlError: string | null;
  disabled: boolean;
  onUrlChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
}

export function VideoAgentImageInput({ mediaCount, url, files, urlError, disabled, onUrlChange, onFilesChange }: Props) {
  const single = mediaCount <= 1;
  const methods: readonly string[] = single ? SINGLE_METHODS : MULTI_METHODS;
  const [method, setMethod] = useState<string>(() => files.length > 0 ? 'Upload' : single ? 'URL' : 'Paste image');
  const [fileError, setFileError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function attach(selected: File[]) {
    try {
      const next = selected.map(normalizeVideoAgentImage);
      if (single) {
        setFileError(null);
        onFilesChange([next[0]]);
        return;
      }
      const merged = [...files, ...next].slice(0, mediaCount);
      setFileError(merged.length > 0 ? null : 'Could not use the image.');
      onFilesChange(merged);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not use the image.');
    }
  }

  function removeFile(index: number) {
    setFileError(null);
    onFilesChange(files.filter((_, current) => current !== index));
  }

  const error = method === 'URL' && single ? urlError : fileError;
  const describedBy = error ? `${ID}-hint ${ID}-error` : `${ID}-hint`;
  const remaining = mediaCount - files.length;

  return (
    <Box display="grid" gap="8px">
      <Box role="group" aria-label="Choose how to add the image" display="flex" flexWrap="wrap" gap="6px">
        {methods.map((option) => (
          <Chip key={option} selected={method === option} disabled={disabled} onClick={() => {
            setMethod(option);
            setFileError(null);
          }}>{option}</Chip>
        ))}
      </Box>
      {method === 'URL' && single && (
        <Input id={ID} value={url} placeholder="https://example.com/photo.jpg"
          disabled={disabled} required={files.length === 0} aria-required={files.length === 0 || undefined}
          aria-invalid={Boolean(urlError) || undefined} aria-describedby={describedBy}
          onChange={(event) => onUrlChange(event.currentTarget.value)} />
      )}
      {method === 'Paste image' && (
        <Input id={ID} autoFocus autoComplete="off" aria-label="Paste image" aria-describedby={describedBy}
          disabled={disabled || (!single && remaining <= 0)} placeholder="Paste here: Ctrl+V / ⌘V"
          onPaste={(event) => {
            event.preventDefault();
            if (!single && remaining <= 0) {
              setFileError(`Remove an image before adding another one (${mediaCount} max).`);
              return;
            }
            const pasted = Array.from(event.clipboardData.files);
            const images = pasted.filter((entry) => entry.type.startsWith('image/') || !entry.type);
            if (images.length === 0) {
              setFileError('Copy an image (not a link), then paste it here.');
              return;
            }
            attach(single ? images.slice(0, 1) : images.slice(0, remaining));
          }}
          onChange={(event) => { event.currentTarget.value = ''; }} />
      )}
      {method === 'Upload' && (
        <Box>
          <Button type="button" variant="outline" size="sm" disabled={disabled || (!single && remaining <= 0)}
            aria-describedby={describedBy} onClick={() => input.current?.click()}>
            Choose image
          </Button>
          <input id={ID} ref={input} hidden type="file" multiple={!single}
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={disabled || (!single && remaining <= 0)}
            onChange={(event) => {
              const selected = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              if (selected.length > 0) attach(single ? selected.slice(0, 1) : selected.slice(0, remaining));
            }} />
        </Box>
      )}

      {single && (files[0] || (url && !urlError)) && (
        <Box display="flex" alignItems="center" gap="10px" minW={0}>
          <MediaReferencePreview reference={files[0] ? '' : url.trim()} localFile={files[0]} alt="Preview of image" />
          <Box flex="1" minW={0} overflowWrap="anywhere">{files[0]?.name ?? 'Image URL'}</Box>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label="Remove image"
            onClick={() => files[0] ? onFilesChange([]) : onUrlChange('')}>Remove</Button>
        </Box>
      )}

      {!single && files.length > 0 && (
        <Box as="ul" display="grid" gap="6px" m={0} p={0} listStyle="none" aria-label="Images to send">
          {files.map((file, index) => (
            <Box as="li" key={`${file.name}-${index}`} display="flex" alignItems="center" gap="10px" minW={0}
              border="1px solid" borderColor="surface.separator" borderRadius="md" px="10px" py="6px">
              <MediaReferencePreview reference="" localFile={file} alt={`Preview of image ${index + 1}`} />
              <Box flex="1" minW={0} overflowWrap="anywhere">{index + 1}. {file.name}</Box>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={`Remove image ${index + 1}`}
                onClick={() => removeFile(index)}>Remove</Button>
            </Box>
          ))}
        </Box>
      )}

      {!single && (
        <Box color={files.length === mediaCount ? 'content.subtle' : 'content.readout'} fontSize="label">
          {files.length} of {mediaCount} images
        </Box>
      )}

      <Box id={`${ID}-hint`} color="content.subtle" fontSize="label">
        {single ? 'JPEG, PNG or WebP. Under 20 MB, shorter side over 300 px, ratio between 2:5 and 5:2.'
          : `This template needs exactly ${mediaCount} images, in order. Each JPEG, PNG or WebP; under 20 MB, shorter side over 300 px, ratio between 2:5 and 5:2.`}
      </Box>
      {error && <Box id={`${ID}-error`} role="alert" color="state.err" fontSize="help">{error}</Box>}
    </Box>
  );
}
