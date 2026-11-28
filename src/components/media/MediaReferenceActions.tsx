'use client';

/**
 * MediaReferenceActions — the single control of the chosen reference method.
 *
 * Paste and Upload send the image to MiniMax's File API with the purpose of
 * the destination and return `mm_file://<file_id>`, the value MiniMax expects.
 * The original file is kept for the local preview, so the user never sees the
 * internal reference. There is no library picker: an existing MiniMax file has
 * no downloadable preview.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { rememberMediaReference } from '@/lib/media-references';
import { MAX_UPLOAD_FILE_SIZE_BYTES, MAX_UPLOAD_FILE_SIZE_MB } from '@/lib/upload-policy';

import { rememberReferencePreview } from './media-reference-previews';

export type MediaUploadPurpose = 'video_generation_input' | 'image_generation_input';

export interface MediaReferenceValue {
  /** `mm_file://<fileId>` — the value MiniMax expects. */
  reference: string;
  fileName: string;
  size: number | null;
}

interface MediaReferenceActionsProps {
  method: 'paste' | 'upload';
  purpose: MediaUploadPurpose;
  /** What the file is used as, e.g. "reference image". */
  label: string;
  disabled?: boolean;
  pasteLimitReached?: boolean;
  onUse: (value: MediaReferenceValue) => void;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'] as const;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
const ACCEPT = IMAGE_EXTENSIONS.join(',');

function isSupportedImage(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  if (IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))) return true;
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function MediaReferenceActions({
  method,
  purpose,
  label,
  disabled = false,
  pasteLimitReached = false,
  onUse,
}: MediaReferenceActionsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeUpload = useRef<AbortController | null>(null);
  const latestOnUse = useRef(onUse);
  const pasteHintId = useId();

  useLayoutEffect(() => {
    latestOnUse.current = onUse;
  }, [onUse]);

  useEffect(() => () => activeUpload.current?.abort(), []);

  const uploadFile = async (file: File) => {
    if (disabled || activeUpload.current) return;

    if (!isSupportedImage(file.name, file.type)) {
      setError(`The ${label} must be a JPG, PNG, WEBP, HEIC or HEIF file.`);
      return;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      setError(`${file.name} is larger than ${MAX_UPLOAD_FILE_SIZE_MB} MB.`);
      return;
    }

    const upload = new AbortController();
    activeUpload.current = upload;
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', purpose);

      const response = await authFetch('/api/minimax/files', { method: 'POST', body: formData, signal: upload.signal });
      if (!response.ok) {
        const err = await parseApiError(response);
        if (upload.signal.aborted) return;
        const parts = [err?.message, err?.details?.upstreamMessage].filter((part): part is string => Boolean(part));
        setError(parts.join(' ') || `Could not upload the ${label} (HTTP ${response.status}).`);
        return;
      }

      const data = await response.json() as { fileId?: string };
      if (upload.signal.aborted) return;
      if (!data.fileId) {
        setError('MiniMax did not return a file id for the upload.');
        return;
      }

      const reference = `mm_file://${data.fileId}`;
      rememberMediaReference(reference, file.name, file.size);
      rememberReferencePreview(reference, file);
      latestOnUse.current({ reference, fileName: file.name, size: file.size });
    } catch {
      if (!upload.signal.aborted) {
        setError(`Could not upload the ${label}. Check your connection and try again.`);
      }
    } finally {
      activeUpload.current = null;
      if (!upload.signal.aborted) setIsUploading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void uploadFile(file);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (disabled || activeUpload.current) return;

    const images = Array.from(event.clipboardData.files).filter(
      (file) => file.type.startsWith('image/') || (!file.type && isSupportedImage(file.name, '')),
    );
    const file = images.find((image) => isSupportedImage(image.name, image.type)) ?? images[0];
    if (!file) {
      setError('Copy an image (not a link), then paste it here.');
      return;
    }
    if (pasteLimitReached) {
      setError('Remove an image before pasting another one.');
      return;
    }

    void uploadFile(file);
  };

  const busy = disabled || isUploading;

  return (
    <Box display="grid" gap="6px">
      {method === 'paste' && (
        <>
          <Input
            autoFocus
            autoComplete="off"
            disabled={disabled}
            aria-label={`Paste ${label}`}
            aria-describedby={pasteHintId}
            placeholder="Paste here: Ctrl+V / ⌘V"
            onPaste={handlePaste}
            onChange={(event) => { event.currentTarget.value = ''; }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
          />
          <Box id={pasteHintId} color="content.subtle" fontSize="help">
            Paste one copied image here to upload it to MiniMax.
          </Box>
          {isUploading && <Box role="status" color="content.readout" fontSize="help">Uploading…</Box>}
        </>
      )}

      {method === 'upload' && (
        <Box display="flex" gap="6px" flexWrap="wrap">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={busy}
            aria-label={`Upload ${label}`}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="file" size={14} />
            {isUploading ? 'Uploading…' : 'Upload image'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            aria-label={`${label} file`}
            disabled={busy}
            onChange={handleFileChange}
          />
        </Box>
      )}

      {error && (
        <Box role="alert" color="state.err" fontSize="help" lineHeight="help">
          {error}
        </Box>
      )}
    </Box>
  );
}
