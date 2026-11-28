/**
 * Media reference helpers shared by the Video and Image forms.
 *
 * MiniMax reads a reference as a public URL, an `mm_file://<id>` value or a
 * data URL. Lists are comma separated, but a data URL carries its own commas
 * (`;base64,`), so the split only breaks where another reference starts.
 */

const REFERENCE_BOUNDARY = /,(?=\s*(?:https?:\/\/|mm_file:\/\/|data:|\s*$))/;

export function splitMediaReferences(value: string): string[] {
  return value
    .split(REFERENCE_BOUNDARY)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function joinMediaReferences(references: readonly string[]): string {
  return references.join(', ');
}

export function mediaReferenceId(reference: string): string | null {
  if (!reference.startsWith('mm_file://')) return null;
  const id = reference.slice('mm_file://'.length).trim();
  return id.length > 0 ? id : null;
}

interface MediaReferenceLabel {
  fileName: string;
  size: number | null;
}

/**
 * Names of the files picked or uploaded during this session. The store keeps a
 * reference, not a file, so the label needs to survive navigation somewhere.
 */
const LABELS = new Map<string, MediaReferenceLabel>();
const MAX_LABELS = 200;

export function rememberMediaReference(reference: string, fileName: string, size: number | null): void {
  if (LABELS.size >= MAX_LABELS) {
    const oldest = LABELS.keys().next().value;
    if (oldest !== undefined) LABELS.delete(oldest);
  }

  LABELS.set(reference, { fileName, size });
}

export function getMediaReferenceLabel(reference: string): MediaReferenceLabel | null {
  const remembered = LABELS.get(reference);
  if (remembered) return remembered;

  const id = mediaReferenceId(reference);
  return id ? { fileName: `MiniMax file ${id}`, size: null } : null;
}
