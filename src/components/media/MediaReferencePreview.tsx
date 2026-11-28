'use client';

import { useEffect, useState } from 'react';

import { mediaReferenceId } from '@/lib/media-references';

import styles from './media-reference-actions.module.css';
import { useReferencePreviewFile } from './media-reference-previews';

function directImageSource(reference: string): string | null {
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(reference)) return reference;
  if (!/^https?:\/\//i.test(reference)) return null;
  try {
    const url = new URL(reference);
    return url.username || url.password ? null : url.href;
  } catch {
    return null;
  }
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.previewPlaceholder}>Preview unavailable</span>;
  return (
    <img
      className={styles.preview}
      alt={alt}
      width={128}
      height={128}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      src={src}
    />
  );
}

export function MediaReferencePreview({ reference, alt, localFile }: { reference: string; alt: string; localFile?: File }) {
  const id = mediaReferenceId(reference);
  const cachedFile = useReferencePreviewFile(reference);
  const file = localFile ?? cachedFile;
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file && id && /^[\w-]+$/.test(id)) {
    return (
      <span className={styles.previewPlaceholder} title="Upload or paste the original image to preview it.">
        No local preview
      </span>
    );
  }

  const src = file ? (preview?.file === file ? preview.url : null) : directImageSource(reference);
  return src
    ? <Thumbnail key={src} src={src} alt={alt} />
    : <span className={styles.previewPlaceholder}>Preview unavailable</span>;
}
