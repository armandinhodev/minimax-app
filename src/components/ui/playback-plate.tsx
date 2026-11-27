"use client";

/**
 * The playback plates.
 *
 * Audio: a slate plate with the title, a waveform, a time ruler and the
 * transport. Video: the frame with a slate strip that names the clip and its
 * duration. The waveform is a deterministic visual, not a measured signal;
 * playback, seeking and the clock are real.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { Box } from "@chakra-ui/react";

import { Icon } from "@/components/ui/icons";

/** mm:ss for a duration in seconds. */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/** A stable waveform profile from the title, so the plate is not random. */
function profile(seed: string, bars = 56): number[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return Array.from({ length: bars }, (_, index) => {
    hash = (hash * 9301 + 49297) % 233280;
    const noise = hash / 233280;
    const envelope = Math.sin((index / bars) * Math.PI) * 0.6 + 0.4;
    return Math.round((0.2 + noise * 0.8) * envelope * 100);
  });
}

function audioSource(src?: string, hex?: string, format = "mp3"): string | undefined {
  if (src) return src;
  if (hex) return `data:audio/${format};base64,${hex}`;
  return undefined;
}

interface AudioPlateProps {
  title: string;
  src?: string;
  /** Base64 audio, when the API returned it instead of a URL. */
  hex?: string;
  format?: string;
  /** Total duration when the payload knows it before metadata loads. */
  durationSeconds?: number;
}

export function AudioPlate({ title, src, hex, format, durationSeconds }: AudioPlateProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);

  const source = audioSource(src, hex, format);
  const bars = useMemo(() => profile(title), [title]);
  const ticks = useMemo(() => Array.from({ length: 28 }, (_, index) => index), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [source]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <Box bg="transport.bg" color="transport.text" borderRadius="md" px="16px" py="14px" display="grid" gap="10px">
      {source && <audio ref={audioRef} src={source} preload="metadata" />}

      <Box fontSize="0.9375rem" fontWeight={700} lineHeight="1.3" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {title}
      </Box>

      <Box position="relative" h="44px" display="flex" alignItems="center" gap="2px">
        {bars.map((height, index) => (
          <Box
            key={index}
            aria-hidden="true"
            flex="1 1 0"
            minW="1px"
            height={`${Math.max(8, height)}%`}
            bg="transport.text"
            opacity={index < (progress / 100) * bars.length ? 1 : 0.55}
            borderRadius="1px"
          />
        ))}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          aria-label={`Seek ${title}`}
          onChange={(event) => seek(Number(event.currentTarget.value))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer" }}
        />
      </Box>

      <Box display="flex" alignItems="center" gap="2px" aria-hidden="true">
        {ticks.map((tick) => (
          <Box key={tick} flex="1 1 0" h={tick % 7 === 0 ? "7px" : "4px"} bg="transport.text" opacity={0.35} />
        ))}
      </Box>

      <Box display="flex" alignItems="center" justifyContent="space-between" gap={4}>
        <button
          type="button"
          onClick={() => void toggle()}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: 0, color: "var(--chakra-colors-transport-text)", cursor: "pointer", font: "inherit", fontSize: "var(--chakra-font-sizes-label)", fontWeight: 700, padding: 0 }}
        >
          <Icon name={playing ? "pause" : "play"} size={14} />
          {playing ? "Pause" : "Play"}
        </button>
        <Box fontFamily="mono" fontSize="mono" color="transport.text" fontVariantNumeric="tabular-nums">
          {clock(current)} / {clock(duration)}
        </Box>
      </Box>
    </Box>
  );
}

interface VideoPlateProps {
  title: string;
  src: string;
  poster?: string;
  durationLabel?: string;
}

export function VideoPlate({ title, src, poster, durationLabel }: VideoPlateProps) {
  return (
    <Box borderRadius="md" overflow="hidden" bg="transport.bg">
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        style={{ display: "block", width: "100%", maxHeight: "22rem", background: "#0b1017" }}
      />
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={4} px="12px" py="9px" color="transport.text">
        <Box fontSize="label" fontWeight={700} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {title}
        </Box>
        <Box fontFamily="mono" fontSize="mono" fontVariantNumeric="tabular-nums" flex="0 0 auto">
          {durationLabel ?? "Video"}
        </Box>
      </Box>
    </Box>
  );
}
