'use client';

import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { authFetch, parseApiError } from '@/lib/auth-client';

const PROMPT_MAX_LENGTH = 32_000;
const MAX_IMAGE_COUNT = 10;

const MODEL_OPTIONS = [
  { value: 'MiniMax-H3-Image', id: 'image-model-standard', label: 'MiniMax-H3-Image', hint: 'Balanced quality' },
  { value: 'MiniMax-H3-Image-Highspeed', id: 'image-model-highspeed', label: 'MiniMax-H3-Image-Highspeed', hint: 'Faster, same limits' },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { value: 'auto', label: 'Auto', size: 'Chosen by MiniMax', hint: 'Prompt decides the frame' },
  { value: '1:1', label: 'Square', size: '1:1', hint: 'Covers and avatars' },
  { value: '16:9', label: 'Widescreen', size: '16:9', hint: 'Hero images' },
  { value: '4:3', label: 'Classic', size: '4:3', hint: 'Editorial frames' },
  { value: '3:2', label: 'Photo', size: '3:2', hint: 'Product shots' },
  { value: '2:3', label: 'Portrait', size: '2:3', hint: 'Posters' },
  { value: '3:4', label: 'Tall card', size: '3:4', hint: 'Social assets' },
  { value: '9:16', label: 'Story', size: '9:16', hint: 'Mobile stories' },
  { value: '21:9', label: 'Cinematic', size: '21:9', hint: 'Banners' },
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
      setActionStatus('Images generated and saved to backend Library. Provider URLs are not guaranteed to stay available, so download the final assets.');
    } catch {
      setError({ code: null, message: 'Failed to generate images. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box display="grid" gap={6} width="100%">
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box maxW="48rem">
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Image Generation</h1>
          <Box color="gray.600" mt={1}>
            Create polished visual assets with MiniMax-H3-Image. The app uses URL output for fast preview, download, and Library access.
          </Box>
        </Box>
        <Box border="1px solid" borderColor="blue.100" borderLeft="3px solid" borderLeftColor="blue.400" borderRadius="md" bg="white" p="0.75rem" color="gray.700" fontSize="sm" maxW="21rem">
          Provider URLs are not guaranteed to stay available. Download final images when you like a result.
        </Box>
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 0.95fr) minmax(0, 1.25fr)' }} gap={6} alignItems="start">
        <Card accent="blue">
          <CardHeader>
            <CardTitle>Creative Brief</CardTitle>
            <CardDescription>
              Be specific about subject, environment, lighting, composition, and style. Better inputs produce more controllable outputs.
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            <Box display="grid" gap={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="image-prompt">Prompt</Label>
                <Box as="span" color={remainingCharacters < 0 ? 'red.600' : 'gray.500'} fontSize="sm">
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
              <Box color="gray.600" fontSize="sm">
                Include what should be visible and the mood you want. Avoid vague prompts like "make it beautiful".
              </Box>
            </Box>

            <Box display="grid" gap={2}>
              <Label>Model</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }}>
                {MODEL_OPTIONS.map((option) => {
                  const isSelected = option.value === model;
                  return (
                    <Button
                      key={option.value}
                      id={option.id}
                      variant={isSelected ? 'solid' : 'outline'}
                      colorPalette={isSelected ? 'blue' : 'gray'}
                      aria-pressed={isSelected}
                      onClick={() => setModel(option.value)}
                      disabled={isLoading}
                      style={{ height: 'auto', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem' }}>
                        <strong>{option.label}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box display="grid" gap={2}>
              <Label>Aspect Ratio</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }}>
                {ASPECT_RATIO_OPTIONS.map((option) => {
                  const isSelected = option.value === aspectRatio;
                  return (
                    <Button
                      key={option.value}
                      id={`image-ratio-${option.value.replace(':', '-')}`}
                      variant={isSelected ? 'solid' : 'outline'}
                      colorPalette={isSelected ? 'blue' : 'gray'}
                      aria-pressed={isSelected}
                      onClick={() => setAspectRatio(option.value)}
                      disabled={isLoading || usesCustomSize}
                      style={{ height: 'auto', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem' }}>
                        <strong>{option.label} ({option.value})</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.size} · {option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
              {usesCustomSize && (
                <Box color="gray.600" fontSize="xs">
                  A custom size replaces the aspect ratio and the area level.
                </Box>
              )}
            </Box>

            <Box display="grid" gap={2}>
              <Label>Area Level</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }}>
                {AREA_OPTIONS.map((option) => {
                  const isSelected = option.value === area;
                  return (
                    <Button
                      key={option.value}
                      id={`image-area-${option.value.toLowerCase()}`}
                      variant={isSelected ? 'solid' : 'outline'}
                      colorPalette={isSelected ? 'blue' : 'gray'}
                      aria-pressed={isSelected}
                      onClick={() => setArea(option.value)}
                      disabled={isLoading || usesCustomSize}
                      style={{ height: 'auto', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem' }}>
                        <strong>{option.label}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={4}>
              <Box display="grid" gap={2}>
                <Label htmlFor="image-size">Custom Size (optional)</Label>
                <Input
                  id="image-size"
                  value={customSize}
                  disabled={isLoading}
                  placeholder="2720x1536"
                  onChange={(event) => setCustomSize(event.currentTarget.value)}
                />
                <Box color="gray.600" fontSize="xs">Width x height. Between 655,360 and 20,000,000 pixels, ratio 1:3 to 3:1.</Box>
              </Box>
              <Box display="grid" gap={2}>
                <Label htmlFor="image-count">Images</Label>
                <Input
                  id="image-count"
                  type="number"
                  min={1}
                  max={MAX_IMAGE_COUNT}
                  value={imageCount}
                  disabled={isLoading}
                  onChange={(event) => setImageCount(Number(event.currentTarget.value))}
                />
                <Box color="gray.600" fontSize="xs">Generate 1 to {MAX_IMAGE_COUNT} variations.</Box>
              </Box>
            </Box>

            <Box display="grid" gap={2}>
              <Label>Output Format</Label>
              <Box display="grid" gap={2} gridTemplateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }}>
                {OUTPUT_FORMAT_OPTIONS.map((option) => {
                  const isSelected = option.value === outputFormat;
                  return (
                    <Button
                      key={option.value}
                      id={`image-format-${option.value}`}
                      variant={isSelected ? 'solid' : 'outline'}
                      colorPalette={isSelected ? 'blue' : 'gray'}
                      aria-pressed={isSelected}
                      onClick={() => setOutputFormat(option.value)}
                      disabled={isLoading}
                      style={{ height: 'auto', justifyContent: 'flex-start', padding: '0.75rem' }}
                    >
                      <span style={{ display: 'grid', textAlign: 'left', gap: '0.125rem' }}>
                        <strong>{option.label}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={4}>
              <Box display="grid" gap={2}>
                <Label htmlFor="image-compression">Output Compression</Label>
                <Input
                  id="image-compression"
                  type="number"
                  min={0}
                  max={100}
                  value={outputCompression}
                  disabled={isLoading || outputFormat === 'png'}
                  onChange={(event) => setOutputCompression(Number(event.currentTarget.value))}
                />
                <Box color="gray.600" fontSize="xs">0 to 100. Applies to JPEG and WEBP only.</Box>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" justifyContent="space-between" gap={3} border="1px solid" borderColor="blue.100" borderRadius="lg" p="0.75rem" bg="white">
              <Box>
                <Label htmlFor="image-prompt-enhancement">Disable Prompt Enhancement</Label>
                <Box color="gray.600" fontSize="sm">
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
              <Box border="1px solid" borderColor="green.100" borderLeft="3px solid" borderLeftColor="green.400" borderRadius="md" bg="white" p="0.75rem" color="green.800" fontSize="sm">
                {actionStatus}
              </Box>
            )}

            <Button onClick={handleGenerate} disabled={isLoading || prompt.trim().length === 0 || prompt.length > PROMPT_MAX_LENGTH} colorPalette="blue">
              {isLoading ? 'Generating images...' : 'Generate Images'}
            </Button>
          </CardContent>
        </Card>

        <Card accent="green" minH="28rem">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {result
                ? `${result.metadata.successCount} generated · ${result.metadata.failedCount} failed · ${resultRatio.label} ${resultRatio.value}`
                : 'Generated images appear here as soon as MiniMax returns URL results.'}
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            {isLoading && (
              <Box border="1px dashed" borderColor="blue.200" borderRadius="xl" p="2rem" textAlign="center" color="gray.600" bg="white">
                Creating {imageCount} {imageCount === 1 ? 'image' : 'images'} with MiniMax-H3-Image...
              </Box>
            )}

            {!isLoading && !result && (
              <Box border="1px dashed" borderColor="gray.200" borderRadius="xl" p="2rem" textAlign="center" color="gray.600" bg="white">
                Start with a clear prompt, choose the frame, then generate. Your results will be saved to backend Library automatically.
              </Box>
            )}

            {result && successfulItems.length > 0 && (
              <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }}>
                {successfulItems.map((item) => (
                  <Box key={`${item.url}-${item.index}`} border="1px solid" borderColor="green.100" borderRadius="xl" overflow="hidden" bg="white" boxShadow="sm">
                    <img
                      src={item.url ?? ''}
                      alt={`Generated image ${item.index + 1}`}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', aspectRatio: resultRatio.value.replace(':', ' / '), objectFit: 'cover', display: 'block', backgroundColor: '#f9fafb' }}
                    />
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} p="0.75rem" flexWrap="wrap">
                      <Box color="gray.600" fontSize="sm">Image {item.index + 1}{item.size ? ` · ${item.size}` : ''}</Box>
                      <Box display="flex" gap={2}>
                        <Button variant="outline" colorPalette="blue" size="sm" onClick={() => window.open(item.url ?? '', '_blank')}>
                          Open
                        </Button>
                        <Button colorPalette="green" size="sm" onClick={() => downloadImageUrl(item.url ?? '', `minimax-image-${result.id}-${item.index + 1}.jpg`)}>
                          Download
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {result && failedItems.length > 0 && (
              <Box border="1px solid" borderColor="red.100" borderLeft="3px solid" borderLeftColor="red.400" borderRadius="md" bg="white" p="0.75rem" color="red.800" fontSize="sm" display="grid" gap="0.25rem">
                {failedItems.map((item) => (
                  <span key={`failure-${item.index}`}>
                    Image {item.index + 1} failed{item.error?.code ? ` (${item.error.code})` : ''}: {item.error?.message}
                  </span>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
