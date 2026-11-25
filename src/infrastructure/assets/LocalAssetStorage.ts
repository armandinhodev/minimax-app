import 'server-only';

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { LibraryAssetKind } from '@/application/dto/library/LibraryDTO';

const DEFAULT_ASSETS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'assets');
const TEST_ASSETS_DIR = path.join(os.tmpdir(), 'minimax-assets-test');

const EXTENSION_BY_FORMAT: Record<string, string> = {
  flac: 'flac',
  jpg: 'jpg',
  jpeg: 'jpg',
  mp3: 'mp3',
  opus: 'opus',
  pcm: 'pcm',
  png: 'png',
  wav: 'wav',
};

export interface StoredLocalAsset {
  storageType: 'local_file';
  storageRef: string;
  sizeBytes: number;
}

export interface LocalAssetFile {
  bytes: Buffer;
  absolutePath: string;
}

export function getLocalAssetsDirectory(): string {
  const configuredDirectory = process.env.MINIMAX_ASSETS_DIR?.trim();
  if (configuredDirectory) return path.resolve(/*turbopackIgnore: true*/ configuredDirectory);
  if (process.env.VITEST) return TEST_ASSETS_DIR;
  return DEFAULT_ASSETS_DIR;
}

function normalizeFormat(format: string | null | undefined): string {
  const normalized = format?.toLowerCase().replace(/^\./, '').trim() || 'bin';
  if (!/^[a-z0-9]+$/.test(normalized)) return 'bin';
  return EXTENSION_BY_FORMAT[normalized] ?? normalized;
}

function safeSegment(segment: string): string {
  return segment.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

function resolveStorageRef(storageRef: string): string {
  const baseDirectory = getLocalAssetsDirectory();
  const absolutePath = path.resolve(baseDirectory, storageRef);
  const relativePath = path.relative(baseDirectory, absolutePath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid local asset storage reference.');
  }

  return absolutePath;
}

export function decodeAssetPayload(payload: string): Buffer {
  const trimmed = payload.trim();
  const withoutDataUrl = trimmed.replace(/^data:[^;]+;base64,/i, '');
  const compact = withoutDataUrl.replace(/\s/g, '');

  if (compact.length > 0 && compact.length % 2 === 0 && /^[0-9a-f]+$/i.test(compact)) {
    return Buffer.from(compact, 'hex');
  }

  if (compact.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    return Buffer.from(compact, 'base64');
  }

  throw new Error('Unsupported asset payload encoding.');
}

export async function writeLocalAsset(input: {
  kind: LibraryAssetKind;
  bytes: Buffer | Uint8Array;
  format?: string | null;
}): Promise<StoredLocalAsset> {
  const bytes = Buffer.from(input.bytes);
  if (bytes.length === 0) throw new Error('Cannot store an empty asset.');

  const directorySegment = safeSegment(input.kind);
  const extension = normalizeFormat(input.format);
  const storageRef = path.posix.join(directorySegment, `${Date.now()}-${randomUUID()}.${extension}`);
  const absolutePath = resolveStorageRef(storageRef);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes, { flag: 'wx' });

  return {
    storageType: 'local_file',
    storageRef,
    sizeBytes: bytes.length,
  };
}

export async function readLocalAsset(storageRef: string): Promise<LocalAssetFile> {
  const absolutePath = resolveStorageRef(storageRef);
  const bytes = await fs.readFile(absolutePath);
  return { bytes, absolutePath };
}

export async function deleteLocalAsset(storageRef: string | null | undefined): Promise<void> {
  if (!storageRef) return;

  try {
    await fs.unlink(resolveStorageRef(storageRef));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
