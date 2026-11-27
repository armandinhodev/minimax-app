'use client';

import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Plate } from '@/components/ui/plate';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { Field, Spec, SpecList } from '@/components/ui/spec';
import { AreaHeader } from '@/components/ui/area-header';
import { Chip } from '@/components/ui/chip';

const PROMPT_MAX_LENGTH = 32_000;
const MAX_IMAGE_COUNT = 10;

const MODEL_OPTIONS = [
  { value: 'MiniMax-H3-Image', id: 'image-model-standard', label: 'MiniMax-H3-Image', hint: 'Balanced quality' },
  { value: 'MiniMax-H3-Image-Highspeed', id: 'image-model-highspeed', label: 'MiniMax-H3-Image-Highspeed', hint: 'Faster, same limits' },
] as const;

const ASPECT_RATIO_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  /** Extra line under the label, when the value alone does not say enough. */
  size?: string;
  hint: string;
}> = [
  { value: 'auto', label: 'Auto', size: 'Chosen by MiniMax', hint: 'Prompt decides the frame' },
  { value: '1:1', label: 'Square', hint: 'Covers and avatars' },
  { value: '16:9', label: 'Widescreen', hint: 'Hero images' },
  { value: '4:3', label: 'Classic', hint: 'Editorial frames' },
  { value: '3:2', label: 'Photo', hint: 'Product shots' },
  { value: '2:3', label: 'Portrait', hint: 'Posters' },
  { value: '3:4', label: 'Tall card', hint: 'Social assets' },
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

export default function ImagePage() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<Model>('MiniMax-H3-Image');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [area, setArea] = useState<Area>('4K');
  const [customSize, setCustomSize] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg');
  const [outputCompression, setOutputCompression] = useState(95);
  const [disablePromptEnhanced, setDisablePromptEnhanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError({ code: null, message: 'Please describe the image you want to create.' });
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
    if (disablePromptEnhanced && !usesCustomSize && aspectRatio === 'auto') {
      setError({
        code: null,
        message: 'Disable prompt enhancement requires a fixed aspect ratio or an explicit width x height size.',
      });
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
      disablePromptEnhanced,
    };

    if (usesCustomSize) {
      body.size = trimmedSize;
    } else {
      body.aspectRatio = aspectRatio;
      body.area = area;
    }

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
      <AreaHeader title="Image generation" description="Compose a visual brief and inspect the resulting images." />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 7fr) minmax(0, 5fr)' }} gap={4} alignItems="start">
        <Sheet>
          <SheetHeader icon="image">
            <SheetTitle>Creative brief</SheetTitle>
            <SheetDescription>Set the composition and delivery format.</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="image-prompt">Prompt</Label>
                <Box as="span" color={remainingCharacters < 0 ? 'state.err' : 'content.subtle'} fontSize="sm">
                  {prompt.length}/{PROMPT_MAX_LENGTH}
                </Box>
              </Box>
              <Textarea
                id="image-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                disabled={isLoading}
                maxLength={PROMPT_MAX_LENGTH + 100}
                minH="10rem"
                placeholder="Example: A premium studio product photo of emerald headphones on warm marble, softbox lighting, shallow depth of field, refined luxury editorial style."
              />
              <Box color="content.readout" fontSize="sm">
                Include what should be visible and the mood you want. Avoid vague prompts like "make it beautiful".
              </Box>
            </Box>

            <Box display="grid" gap="8px">
              <Label>Model</Label>
              <Box display="flex" gap="8px" flexWrap="wrap">
                {MODEL_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    id={option.id}
                    selected={option.value === model}
                    disabled={isLoading}
                    onClick={() => setModel(option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </Box>
              <Box color="content.readout" fontSize="help">
                Quality model selected. Choose Highspeed for faster results.
              </Box>
            </Box>

            <Box display="grid" gap="8px">
              <Label>Aspect ratio</Label>
              <Box display="flex" gap="8px" flexWrap="wrap">
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    id={`image-ratio-${option.value.replace(':', '-')}`}
                    selected={option.value === aspectRatio}
                    disabled={isLoading || usesCustomSize}
                    onClick={() => setAspectRatio(option.value)}
                  >
                    {option.value === 'auto' ? 'Auto' : option.value}
                  </Chip>
                ))}
              </Box>
              {usesCustomSize && (
                <Box color="content.readout" fontSize="help">
                  A custom size replaces the aspect ratio and the area level.
                </Box>
              )}
            </Box>

            <Box display="grid" gap="8px">
              <Label>Area level</Label>
              <Box display="flex" gap="8px" flexWrap="wrap">
                {AREA_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    id={'image-area-' + option.value.toLowerCase()}
                    selected={option.value === area}
                    disabled={isLoading || usesCustomSize}
                    onClick={() => setArea(option.value)}
                  >
                    {option.value}
                  </Chip>
                ))}
              </Box>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={4}>
                            <Field label="Custom size" htmlFor="image-size">
                <Input
                                  id="image-size"
                                  value={customSize}
                                  disabled={isLoading}
                                  placeholder="2720x1536"
                                  onChange={(event) => setCustomSize(event.currentTarget.value)}
                                />
                                <Box color="content.readout" fontSize="xs">Width x height. Between 655,360 and 20,000,000 pixels, ratio 1:3 to 3:1.</Box>
              </Field>
                            <Field label="Images" htmlFor="image-count">
                <Input
                                  id="image-count"
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

            <Box display="grid" gap="8px">
              <Label>Output format</Label>
              <Box display="flex" gap="8px" flexWrap="wrap">
                {OUTPUT_FORMAT_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    id={`image-format-${option.value}`}
                    selected={option.value === outputFormat}
                    disabled={isLoading}
                    onClick={() => setOutputFormat(option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </Box>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={4}>
                            <Field label="Output compression" htmlFor="image-compression">
                <Input
                                  id="image-compression"
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={outputCompression}
                                  disabled={isLoading || outputFormat === 'png'}
                                  onChange={(event) => setOutputCompression(Number(event.currentTarget.value))}
                                />
                                <Box color="content.readout" fontSize="xs">0 to 100. Applies to JPEG and WEBP only.</Box>
              </Field>
            </Box>

            <Box display="flex" alignItems="center" justifyContent="space-between" gap={3} border="1px solid" borderColor="interaction.soft" borderRadius="lg" p="0.75rem" bg="surface.sheet">
              <Box>
                <Label htmlFor="image-prompt-enhancement">Disable prompt enhancement</Label>
                <Box color="content.readout" fontSize="sm">
                  MiniMax rewrites your prompt by default. Turn this off to send the prompt unchanged; a fixed ratio or size is then required.
                </Box>
              </Box>
              <Switch
                id="image-prompt-enhancement"
                checked={disablePromptEnhanced}
                onChange={setDisablePromptEnhanced}
                disabled={isLoading}
              />
            </Box>

            {error && <ErrorDisplay code={error.code ?? null} message={error.message ?? ''} />}
            {actionStatus && !error && (
              <Box borderRadius="md" bg="state.okSoft" px="12px" py="10px" color="content.ink" fontSize="label">
                {actionStatus}
              </Box>
            )}

            <Button onClick={handleGenerate} disabled={isLoading || prompt.trim().length === 0 || prompt.length > PROMPT_MAX_LENGTH}>
              {isLoading ? 'Generating images...' : 'Generate images'}
            </Button>
          </SheetContent>
        </Sheet>

        <Plate minH="28rem" position="sticky" top="4.5rem" title="Results" description="Latest image batch.">
            {result && (
              <SpecList>
                <Spec label="Generated" value={String(result.metadata.successCount)} />
                <Spec label="Failed" value={String(result.metadata.failedCount)} />
                <Spec label="Aspect ratio" value={resultRatio.value} />
              </SpecList>
            )}
            {isLoading && (
              <Box borderRadius="md" p="2rem" textAlign="center" color="content.readout" bg="surface.inset">
                Creating {imageCount} {imageCount === 1 ? 'image' : 'images'} with MiniMax-H3-Image...
              </Box>
            )}

            {!isLoading && !result && (
              <Box borderRadius="md" p="2rem" minH="22rem" flex="1" display="grid" alignItems="center" justifyItems="center" textAlign="center" color="content.readout" bg="surface.inset">
                <Box maxW="22rem">
                  <Box fontFamily="mono" fontSize="label" color="content.subtle" mb={2}>No result yet</Box>
                  Start with a clear prompt, choose the frame, then generate. Your results are saved to Library automatically.
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
                        <Button size="sm" onClick={() => downloadImageUrl(item.url ?? '', `minimax-image-${result.id}-${item.index + 1}.jpg`)}>
                          Download
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {result && failedItems.length > 0 && (
              <Box borderRadius="md" bg="state.errSoft" px="12px" py="10px" color="content.ink" fontSize="label" display="grid" gap="0.25rem">
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
