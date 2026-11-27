'use client';

import { type ChangeEvent, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Plate } from '@/components/ui/plate';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { Field, Spec, SpecList } from '@/components/ui/spec';
import { AreaHeader } from '@/components/ui/area-header';

const PROMPT_MAX_LENGTH = 32_000;
const MAX_IMAGE_COUNT = 10;
const MAX_REFERENCE_IMAGES = 16;
const MAX_REFERENCE_BYTES = 64 * 1024 * 1024;
const ALLOWED_REFERENCE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MODEL_OPTIONS = [
  { value: 'MiniMax-H3-Image', id: 'image-edit-model-standard', label: 'MiniMax-H3-Image', hint: 'Balanced quality' },
  { value: 'MiniMax-H3-Image-Highspeed', id: 'image-edit-model-highspeed', label: 'MiniMax-H3-Image-Highspeed', hint: 'Faster, same limits' },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { value: 'auto', label: 'Auto', hint: 'Chosen by MiniMax' },
  { value: '1:1', label: 'Square', hint: 'Profile and social crops' },
  { value: '16:9', label: 'Widescreen', hint: 'Hero images' },
  { value: '4:3', label: 'Classic', hint: 'Editorial frames' },
  { value: '3:2', label: 'Photo', hint: 'Portrait sessions' },
  { value: '2:3', label: 'Portrait', hint: 'Posters' },
  { value: '3:4', label: 'Tall card', hint: 'Profile cards' },
  { value: '9:16', label: 'Story', hint: 'Mobile stories' },
  { value: '21:9', label: 'Cinematic', hint: 'Banners' },
] as const;

const AREA_OPTIONS = [
  { value: '1K', label: '1K', hint: '1024 x 1024 target' },
  { value: '2K', label: '2K', hint: '2048 x 2048 target' },
  { value: '4K', label: '4K', hint: '4096 x 4096 target' },
] as const;

const OUTPUT_FORMAT_OPTIONS = [
  { value: 'jpeg', label: 'JPEG', hint: 'Default' },
  { value: 'png', label: 'PNG', hint: 'Lossless' },
  { value: 'webp', label: 'WEBP', hint: 'Small files' },
] as const;

type Model = (typeof MODEL_OPTIONS)[number]['value'];
type AspectRatio = (typeof ASPECT_RATIO_OPTIONS)[number]['value'];
type Area = (typeof AREA_OPTIONS)[number]['value'];
type OutputFormat = (typeof OUTPUT_FORMAT_OPTIONS)[number]['value'];

interface ReferenceImage {
  name: string;
  size: number;
  dataUrl: string;
}

interface ImageResultItem {
  index: number;
  url: string | null;
  size: string | null;
  revisedPrompt: string | null;
  error: { code: string | null; message: string } | null;
}

interface ImageGenerationResult {
  id: string;
  imageUrls: string[];
  images: ImageResultItem[];
  metadata: {
    successCount: number;
    failedCount: number;
    totalCount: number;
    outputFormat: string;
    requestId: string | null;
  };
  expiresAt: number | null;
}

function toDisplayItems(result: ImageGenerationResult): ImageResultItem[] {
  if (result.images?.length) return result.images;
  return result.imageUrls.map((url, index) => ({
    index,
    url,
    size: null,
    revisedPrompt: null,
    error: null,
  }));
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function validateReferenceFile(file: File): string | null {
  if (!ALLOWED_REFERENCE_MIME_TYPES.has(file.type)) {
    return 'Reference images must be JPG, JPEG, PNG, WEBP, HEIC or HEIF files.';
  }
  if (file.size >= MAX_REFERENCE_BYTES) {
    return `Reference images must be smaller than 64MB. Selected file is ${formatBytes(file.size)}.`;
  }
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read reference image'));
    reader.readAsDataURL(file);
  });
}

function downloadImageUrl(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function ImageToImagePage() {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<Model>('MiniMax-H3-Image');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [area, setArea] = useState<Area>('4K');
  const [customSize, setCustomSize] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg');
  const [outputCompression, setOutputCompression] = useState(95);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [error, setError] = useState<{ code: number | null; message: string | null } | null>(null);
  const [result, setResult] = useState<ImageGenerationResult | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const remainingCharacters = PROMPT_MAX_LENGTH - prompt.length;
  const trimmedSize = customSize.trim();
  const usesCustomSize = trimmedSize.length > 0;
  const resultRatio = ASPECT_RATIO_OPTIONS.find((option) => option.value === aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
  const displayItems = result ? toDisplayItems(result) : [];
  const successfulItems = displayItems.filter((item) => item.url !== null);
  const failedItems = displayItems.filter((item) => item.error !== null);

  const handleReferenceImagesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    setResult(null);
    setActionStatus(null);

    if (files.length === 0) {
      setReferenceImages([]);
      return;
    }

    if (files.length > MAX_REFERENCE_IMAGES) {
      setReferenceImages([]);
      setError({ code: null, message: `You can attach at most ${MAX_REFERENCE_IMAGES} reference images.` });
      event.currentTarget.value = '';
      return;
    }

    for (const file of files) {
      const validationError = validateReferenceFile(file);
      if (validationError) {
        setReferenceImages([]);
        setError({ code: null, message: validationError });
        event.currentTarget.value = '';
        return;
      }
    }

    setIsReadingFile(true);
    setError(null);
    try {
      const loaded = await Promise.all(files.map(async (file) => ({
        name: file.name,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      })));
      setReferenceImages(loaded);
    } catch {
      setReferenceImages([]);
      setError({ code: null, message: 'Could not read the reference images. Choose other files and try again.' });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();

    if (referenceImages.length === 0) {
      setError({ code: null, message: 'Attach at least one reference image before generating.' });
      return;
    }
    if (!trimmedPrompt) {
      setError({ code: null, message: 'Please describe how MiniMax should transform the reference images.' });
      return;
    }
    if (trimmedPrompt.length > PROMPT_MAX_LENGTH) {
      setError({ code: null, message: 'Prompt exceeds 32,000 characters.' });
      return;
    }
    if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > MAX_IMAGE_COUNT) {
      setError({ code: null, message: `Choose between 1 and ${MAX_IMAGE_COUNT} images.` });
      return;
    }
    if (!Number.isInteger(outputCompression) || outputCompression < 0 || outputCompression > 100) {
      setError({ code: null, message: 'Output compression must be a whole number between 0 and 100.' });
      return;
    }
    if (usesCustomSize && !/^\d+x\d+$/.test(trimmedSize)) {
      setError({ code: null, message: 'Custom size must use the WIDTHxHEIGHT format, for example 2720x1536.' });
      return;
    }

    setError(null);
    setActionStatus(null);
    setIsLoading(true);
    setResult(null);

    const body: Record<string, unknown> = {
      prompt: trimmedPrompt,
      model,
      n: imageCount,
      outputFormat,
      responseFormat: 'url',
      outputCompression,
    };

    if (usesCustomSize) {
      body.size = trimmedSize;
    } else {
      body.aspectRatio = aspectRatio;
      body.area = area;
    }

    body.images = referenceImages.map((reference) => ({ imageUrl: reference.dataUrl }));

    try {
      const response = await authFetch('/api/minimax/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json() as ImageGenerationResult;
      setResult(data);
      setActionStatus('Images generated and saved to Library. Provider URLs are not guaranteed to stay available, so download the final assets.');
    } catch {
      setError({ code: null, message: 'Failed to generate images. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <AreaHeader title="Image to Image" description="Transform 1 to 16 reference images with MiniMax-H3-Image while keeping uploads and API keys server-safe." note="Image edits always apply prompt enhancement. Reference images are forwarded to MiniMax, never fetched by this server." />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 7fr) minmax(0, 5fr)' }} gap={0} alignItems="start">
        <Sheet>
          <SheetHeader>
            <SheetTitle>References and direction</SheetTitle>
            <SheetDescription>
              Attach JPG, PNG, WEBP, HEIC or HEIF images under 64MB each, then describe the transformation, style, composition, and mood.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
                        <Field label="Reference images" htmlFor="reference-images">
              <Input
                              id="reference-images"
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                              disabled={isLoading || isReadingFile}
                              onChange={handleReferenceImagesChange}
                            />
                            <Box color="content.readout" fontSize="sm">
                              Attach between 1 and {MAX_REFERENCE_IMAGES} images. The upload order is the picture number used in your prompt.
                            </Box>
            </Field>

            {referenceImages.length > 0 && (
              <Box border="1px solid" borderColor="interaction.soft" borderRadius="xl" overflow="hidden" bg="surface.sheet">
                <Box display="grid" gap={2} p="0.75rem">
                  {referenceImages.map((reference, index) => (
                    <Box key={`${reference.name}-${index}`} display="flex" alignItems="center" justifyContent="space-between" gap={2} color="content.readout" fontSize="sm">
                      <span>{index + 1}. {reference.name}</span>
                      <span>{formatBytes(reference.size)}</span>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="image-edit-prompt">Prompt</Label>
                <Box as="span" color={remainingCharacters < 0 ? 'state.err' : 'content.subtle'} fontSize="sm">
                  {prompt.length}/{PROMPT_MAX_LENGTH}
                </Box>
              </Box>
              <Textarea
                id="image-edit-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                disabled={isLoading}
                maxLength={PROMPT_MAX_LENGTH + 100}
                minH="9rem"
                placeholder="Example: Replace the cat in picture 1 with the Shiba Inu in picture 2, keep the background and lighting unchanged."
              />
            </Box>

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Label>Model</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }}>
                {MODEL_OPTIONS.map((option) => {
                  const isSelected = option.value === model;
                  return (
                    <Button
                      key={option.value}
                      id={option.id}
                      variant={'outline'}
                      aria-pressed={isSelected}
                      onClick={() => setModel(option.value)}
                      disabled={isLoading}
                      style={{ height: 'auto', width: '100%', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem', whiteSpace: 'normal', minWidth: 0 }}>
                        <strong>{option.label}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Label>Aspect ratio</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }}>
                {ASPECT_RATIO_OPTIONS.map((option) => {
                  const isSelected = option.value === aspectRatio;
                  return (
                    <Button
                      key={option.value}
                      id={`image-edit-ratio-${option.value.replace(':', '-')}`}
                      variant={'outline'}
                      aria-pressed={isSelected}
                      onClick={() => setAspectRatio(option.value)}
                      disabled={isLoading || usesCustomSize}
                      style={{ height: 'auto', width: '100%', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem', whiteSpace: 'normal', minWidth: 0 }}>
                        <strong>{option.label} ({option.value})</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Label>Area level</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }}>
                {AREA_OPTIONS.map((option) => {
                  const isSelected = option.value === area;
                  return (
                    <Button
                      key={option.value}
                      id={`image-edit-area-${option.value.toLowerCase()}`}
                      variant={'outline'}
                      aria-pressed={isSelected}
                      onClick={() => setArea(option.value)}
                      disabled={isLoading || usesCustomSize}
                      style={{ height: 'auto', width: '100%', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem', whiteSpace: 'normal', minWidth: 0 }}>
                        <strong>{option.label}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={4}>
                            <Field label="Custom size" htmlFor="image-edit-size">
                <Input
                                  id="image-edit-size"
                                  value={customSize}
                                  disabled={isLoading}
                                  placeholder="2720x1536"
                                  onChange={(event) => setCustomSize(event.currentTarget.value)}
                                />
                                <Box color="content.readout" fontSize="xs">Width x height. Between 655,360 and 20,000,000 pixels, ratio 1:3 to 3:1.</Box>
              </Field>
                            <Field label="Images" htmlFor="image-edit-count">
                <Input
                                  id="image-edit-count"
                                  type="number"
                                  min={1}
                                  max={MAX_IMAGE_COUNT}
                                  value={imageCount}
                                  disabled={isLoading}
                                  onChange={(event) => setImageCount(Number(event.currentTarget.value))}
                                />
                                <Box color="content.readout" fontSize="xs">Generate 1 to {MAX_IMAGE_COUNT} variations.</Box>
              </Field>
            </Box>

            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Label>Output format</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }}>
                {OUTPUT_FORMAT_OPTIONS.map((option) => {
                  const isSelected = option.value === outputFormat;
                  return (
                    <Button
                      key={option.value}
                      id={`image-edit-format-${option.value}`}
                      variant={'outline'}
                      aria-pressed={isSelected}
                      onClick={() => setOutputFormat(option.value)}
                      disabled={isLoading}
                      style={{ height: 'auto', width: '100%', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem', whiteSpace: 'normal', minWidth: 0 }}>
                        <strong>{option.label}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

                        <Field label="Output compression" htmlFor="image-edit-compression">
              <Input
                              id="image-edit-compression"
                              type="number"
                              min={0}
                              max={100}
                              value={outputCompression}
                              disabled={isLoading || outputFormat === 'png'}
                              onChange={(event) => setOutputCompression(Number(event.currentTarget.value))}
                            />
                            <Box color="content.readout" fontSize="xs">0 to 100. Applies to JPEG and WEBP only.</Box>
            </Field>

            {error && <ErrorDisplay code={error.code ?? null} message={error.message ?? ''} />}
            {actionStatus && !error && (
              <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="state.ok" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
                {actionStatus}
              </Box>
            )}

            <Button onClick={handleGenerate} disabled={isLoading || isReadingFile || referenceImages.length === 0 || prompt.trim().length === 0 || prompt.length > PROMPT_MAX_LENGTH}>
              {isLoading ? 'Generating images...' : isReadingFile ? 'Preparing references...' : 'Generate images'}
            </Button>
          </SheetContent>
        </Sheet>

        <Plate minH="28rem" position="sticky" top="4.5rem" title="Results" description={result
          ? 'The images MiniMax returned, with the frame you asked for.'
          : 'Generated images appear here as soon as MiniMax returns URL results.'}>
            {result && (
              <SpecList>
                <Spec label="Generated" value={String(result.metadata.successCount)} />
                <Spec label="Failed" value={String(result.metadata.failedCount)} />
                <Spec label="Aspect ratio" value={resultRatio.value} />
              </SpecList>
            )}
            {isLoading && (
              <Box border="1px dashed" borderColor="interaction.soft" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                Creating {imageCount} {imageCount === 1 ? 'image' : 'images'} from your reference images...
              </Box>
            )}

            {!isLoading && !result && (
              <Box border="1px dashed" borderColor="surface.rule" borderRadius="sm" p="2rem" minH="22rem" flex="1" display="grid" alignItems="center" justifyItems="center" textAlign="center" color="content.readout" bg="surface.field">
                <Box maxW="22rem">
                  <Box fontFamily="mono" fontSize="label" color="content.subtle" mb={2}>No result yet</Box>
                  Attach your reference images, describe the desired direction, then generate. Results are saved to Library automatically.
                </Box>
              </Box>
            )}

            {result && successfulItems.length > 0 && (
              <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }}>
                {successfulItems.map((item) => (
                  <Box key={`${item.url}-${item.index}`} border="1px solid" borderColor="surface.rule" borderRadius="lg" overflow="hidden" bg="surface.plate">
                    <img
                      src={item.url ?? ''}
                      alt={`Generated image ${item.index + 1}`}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', aspectRatio: resultRatio.value.replace(':', ' / '), objectFit: 'cover', display: 'block', backgroundColor: 'var(--chakra-colors-surface-field)' }}
                    />
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} p="0.75rem" flexWrap="wrap">
                      <Box display="grid" gap="0.125rem">
                        <Box color="content.readout" fontSize="sm">Image {item.index + 1}</Box>
                        {item.size && (
                          <Box color="content.subtle" fontSize="xs">{item.size}</Box>
                        )}
                      </Box>
                      <Box display="flex" gap={2}>
                        <Button variant="outline" size="sm" onClick={() => window.open(item.url ?? '', '_blank')}>
                          Open
                        </Button>
                        <Button size="sm" onClick={() => downloadImageUrl(item.url ?? '', `minimax-image-edit-${result.id}-${item.index + 1}.jpg`)}>
                          Download
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {result && failedItems.length > 0 && (
              <Box border="1px solid" borderColor="state.errSoft" borderLeft="3px solid" borderLeftColor="state.err" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.err" fontSize="sm" display="grid" gap="0.25rem">
                {failedItems.map((item) => (
                  <span key={`failure-${item.index}`}>
                    Image {item.index + 1} failed{item.error?.code ? ` (${item.error.code})` : ''}: {item.error?.message}
                  </span>
                ))}
              </Box>
            )}
        </Plate>
      </Box>
    </Box>
  );
}
