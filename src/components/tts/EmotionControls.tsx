"use client";

/**
 * Emotion controls for text to speech.
 *
 * Two documented paths: the `emotion` preset sent to the API, and the inline
 * interjection tags typed into the text. Tags are only read by Speech 2.8.
 */

import { Box } from "@chakra-ui/react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/spec";
import {
  T2A_INTERJECTION_TAGS,
  emotionsForModel,
  supportsInterjectionTags,
  type T2AEmotion,
} from "@/domain/value-objects/T2APolicy";

const EMOTION_LABELS: Record<T2AEmotion, string> = {
  happy: "Happy",
  sad: "Sad",
  angry: "Angry",
  fearful: "Fearful",
  disgusted: "Disgusted",
  surprised: "Surprised",
  calm: "Calm",
  fluent: "Fluent",
  whisper: "Whisper",
};

interface EmotionSelectProps {
  value: "auto" | T2AEmotion;
  model: string;
  disabled?: boolean;
  onChange: (value: "auto" | T2AEmotion) => void;
}

export function EmotionSelect({ value, model, disabled = false, onChange }: EmotionSelectProps) {
  const options = [
    { value: "auto", label: "Auto (from text)" },
    ...emotionsForModel(model).map((emotion) => ({ value: emotion, label: EMOTION_LABELS[emotion] })),
  ];

  return (
    <Field label="Emotion" htmlFor="tts-emotion">
      <Select
        id="tts-emotion"
        value={value}
        options={options}
        disabled={disabled}
        onValueChange={(next) => onChange(next as "auto" | T2AEmotion)}
      />
      <Box color="content.readout" fontSize="help" lineHeight="help" mt="6px">
        Auto lets the model read the text. A preset overrides it.
      </Box>
    </Field>
  );
}

interface EmotionTagsProps {
  model: string;
  disabled?: boolean;
  onInsert: (tag: string) => void;
}

export function EmotionTags({ model, disabled = false, onInsert }: EmotionTagsProps) {
  const supported = supportsInterjectionTags(model);

  return (
    <Box display="grid" gap="6px">
      <Label htmlFor="tts-emotion-tag">Emotion tags</Label>
      <Select
        id="tts-emotion-tag"
        value=""
        placeholder={supported ? "Insert a tag at the cursor" : "Not read by this model"}
        options={T2A_INTERJECTION_TAGS.map((tag) => ({ value: tag, label: `(${tag})` }))}
        disabled={disabled || !supported}
        onValueChange={(tag) => tag && onInsert(tag)}
      />
      <Box color="content.readout" fontSize="help" lineHeight="help">
        {supported
          ? "MiniMax reads the tag after the word it colors: people(sighs), then the next line."
          : "Only Speech 2.8 models read interjection tags. Switch the model to use them."}
      </Box>
    </Box>
  );
}
