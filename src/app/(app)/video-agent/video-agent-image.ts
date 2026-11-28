import { VIDEO_AGENT_MAX_MEDIA_BYTES, validateTemplateMediaReference } from '@/application/dto/minimax/video-agent/VideoAgentDTO';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateVideoAgentImageReference(value: string): string | null {
  if (/^mm_file:\/\//i.test(value)) {
    return 'Video Agent cannot use a MiniMax file ID. Paste or upload the original image, or enter a public URL.';
  }
  if (!value) return null;
  const issue = validateTemplateMediaReference(value);
  return issue?.includes('mm_file://') ? 'Enter a public HTTP(S) image URL.' : issue;
}

export function normalizeVideoAgentImage(file: File): File {
  const match = /\.(jpe?g|png|webp)$/i.exec(file.name)?.[1]?.toLowerCase();
  const type = file.type || (match ? `image/${match === 'jpg' ? 'jpeg' : match}` : '');
  if (!IMAGE_TYPES.includes(type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size >= VIDEO_AGENT_MAX_MEDIA_BYTES) throw new Error('The image must be non-empty and smaller than 20 MB.');
  return file.type === type ? file : new File([file], file.name, { type });
}

export async function encodeVideoAgentImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not open the image. Try a different JPEG, PNG or WebP file.');
  });
  try {
    const { width, height } = bitmap;
    if (Math.min(width, height) <= 300) throw new Error('The image’s shorter side must be greater than 300 px.');
    const ratio = width / height;
    if (ratio < 2 / 5 || ratio > 5 / 2) throw new Error('The image aspect ratio must be between 2:5 and 5:2.');
  } finally {
    bitmap.close();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the image. Choose it again and retry.'));
    reader.onerror = reader.onabort = () => reject(new Error('Could not read the image. Choose it again and retry.'));
    reader.readAsDataURL(file);
  });
}
