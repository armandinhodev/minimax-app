'use client';

import { Box } from '@chakra-ui/react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/spec';

import type { VideoMediaValues } from './video-options';

export interface VideoMediaFieldsProps {
  idPrefix: string;
  values: VideoMediaValues;
  disabled?: boolean;
  onChange: (key: keyof VideoMediaValues, value: string) => void;
}

const FIELDS: Array<{
  key: keyof VideoMediaValues;
  id: string;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    key: 'firstFrame',
    id: 'first-frame',
    label: 'First frame image URL',
    hint: 'Optional. A first frame turns the request into an image-to-video task.',
    placeholder: 'https://cdn.example.com/first-frame.png',
  },
  {
    key: 'lastFrame',
    id: 'last-frame',
    label: 'Last frame image URL',
    hint: 'Optional. Requires a first frame image.',
    placeholder: 'https://cdn.example.com/last-frame.png',
  },
  {
    key: 'referenceImages',
    id: 'reference-images',
    label: 'Reference image URLs',
    hint: 'Optional. Up to 9, separated by commas.',
    placeholder: 'https://cdn.example.com/reference.png',
  },
  {
    key: 'referenceVideos',
    id: 'reference-videos',
    label: 'Reference video URLs',
    hint: 'Optional. Up to 3, separated by commas.',
    placeholder: 'https://cdn.example.com/reference.mp4',
  },
  {
    key: 'referenceAudio',
    id: 'reference-audio',
    label: 'Reference audio URLs',
    hint: 'Optional. Up to 3, separated by commas.',
    placeholder: 'https://cdn.example.com/reference.mp3',
  },
];

/**
 * Media reference inputs shared by the generation and context-ir forms.
 *
 * References are only checked for syntax in the browser; the server never
 * downloads them.
 */
export function VideoMediaFields({ idPrefix, values, disabled, onChange }: VideoMediaFieldsProps) {
  return (
    <Box display="grid" gap={0}>
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label}>
          <Box display="grid" gap={1}>
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
        </Field>
      ))}
    </Box>
  );
}
