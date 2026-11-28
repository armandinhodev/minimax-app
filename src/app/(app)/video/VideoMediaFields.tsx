'use client';

import { Box } from '@chakra-ui/react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/spec';
import { MediaReferenceField } from '@/components/media/MediaReferenceField';

import type { VideoMediaValues } from './video-options';

export interface VideoMediaFieldsProps {
  idPrefix: string;
  values: VideoMediaValues;
  disabled?: boolean;
  onChange: (key: keyof VideoMediaValues, value: string) => void;
  /** Surfaces limits that would otherwise be silent (too many images). */
  onMediaError?: (message: string) => void;
}

const FIELDS: Array<{
  key: keyof VideoMediaValues;
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  kind: 'image' | 'video' | 'audio';
  pickerLabel?: string;
  multiple?: boolean;
  maxItems?: number;
}> = [
  {
    key: 'firstFrame',
    id: 'first-frame',
    label: 'First frame image',
    hint: 'Optional. A first frame turns the request into an image-to-video task.',
    placeholder: 'https://cdn.example.com/first-frame.png',
    kind: 'image',
    pickerLabel: 'first frame',
  },
  {
    key: 'lastFrame',
    id: 'last-frame',
    label: 'Last frame image',
    hint: 'Optional. Requires a first frame image.',
    placeholder: 'https://cdn.example.com/last-frame.png',
    kind: 'image',
    pickerLabel: 'last frame',
  },
  {
    key: 'referenceImages',
    id: 'reference-images',
    label: 'Reference images',
    hint: 'Optional. Up to 9 images.',
    placeholder: 'https://cdn.example.com/reference.png',
    kind: 'image',
    pickerLabel: 'reference image',
    multiple: true,
    maxItems: 9,
  },
  {
    key: 'referenceVideos',
    id: 'reference-videos',
    label: 'Reference video URLs',
    hint: 'Optional. Up to 3, separated by commas.',
    placeholder: 'https://cdn.example.com/reference.mp4',
    kind: 'video',
  },
  {
    key: 'referenceAudio',
    id: 'reference-audio',
    label: 'Reference audio URLs',
    hint: 'Optional. Up to 3, separated by commas.',
    placeholder: 'https://cdn.example.com/reference.mp3',
    kind: 'audio',
  },
];

/**
 * Media reference inputs shared by the generation, context-ir and regeneration
 * forms.
 *
 * Image fields accept a URL, a pasted or uploaded image, or an existing MiniMax
 * image, and end in the same value the API expects. Public URL thumbnails
 * load directly in the browser; the server does not fetch those URLs.
 */
export function VideoMediaFields({ idPrefix, values, disabled, onChange, onMediaError }: VideoMediaFieldsProps) {
  return (
    <Box display="grid" gap={4} gridTemplateColumns="minmax(0, 1fr)">
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label}>
          {field.kind === 'image' ? (
            <MediaReferenceField
              id={`${idPrefix}-${field.id}`}
              purpose="video_generation_input"
              label={field.pickerLabel ?? 'reference image'}
              value={values[field.key]}
              onChange={(next) => onChange(field.key, next)}
              multiple={field.multiple}
              maxItems={field.maxItems}
              disabled={disabled}
              placeholder={field.placeholder}
              hint={field.hint}
              onMediaError={onMediaError}
            />
          ) : (
            <Box display="grid" gap="8px" gridTemplateColumns="minmax(0, 1fr)">
              <Input
                id={`${idPrefix}-${field.id}`}
                value={values[field.key]}
                disabled={disabled}
                placeholder={field.placeholder}
                onChange={(event) => onChange(field.key, event.currentTarget.value)}
              />
              <Box color="content.subtle" fontSize="label" lineHeight="label">
                {field.hint}
              </Box>
            </Box>
          )}
        </Field>
      ))}
    </Box>
  );
}
