'use client';

/**
 * AudioPlayer — hex audio playback on the slate plate.
 *
 * The Web Audio path is unchanged (decode, play, pause, seek). The surface is
 * the playback plate of the studio: title, waveform, time ruler and clock.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

/**
 * Convert a hex string to an ArrayBuffer.
 * Each pair of hex characters represents one byte.
 */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const clean = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Convert a hex string to a Uint8Array.
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

interface AudioPlayerProps {
  hex: string;
  format?: string;
  onDownload?: (hex: string) => void;
  /** What the clip is, shown on the plate. */
  title?: string;
  /** Hides the plate download when the page already offers one. */
  showDownload?: boolean;
  downloadLabel?: string;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

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

export function AudioPlayer({
  hex,
  format = 'mp3',
  onDownload,
  title = 'Audio',
  showDownload = true,
  downloadLabel = 'Download audio',
}: AudioPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioDataRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [webAudioSupported, setWebAudioSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bars = profile(title);
  const ticks = Array.from({ length: 28 }, (_, index) => index);

  // Detect Web Audio API support
  useEffect(() => {
    try {
      const ctx = new AudioContext();
      setWebAudioSupported(true);
      ctx.close();
    } catch {
      setWebAudioSupported(false);
    }
  }, []);

  // Decode audio when hex changes
  useEffect(() => {
    if (!hex || !webAudioSupported) return;

    const decode = async () => {
      setPlaybackState('loading');
      setErrorMessage(null);
      try {
        const ctx = new AudioContext();
        audioContextRef.current = ctx;

        const arrayBuffer = hexToArrayBuffer(hex);
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioDataRef.current = audioBuffer;
        setDuration(audioBuffer.duration);
        setPlaybackState('idle');
        setCurrentTime(0);
      } catch (_err) {
        setPlaybackState('error');
        setErrorMessage('Failed to decode audio data.');
      }
    };

    decode();

    return () => {
      stop();
      audioContextRef.current?.close();
    };
  }, [hex]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(
    (offset: number = 0) => {
      const ctx = audioContextRef.current;
      const buffer = audioDataRef.current;
      if (!ctx || !buffer) return;

      stop();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0, offset);
      sourceRef.current = source;

      startTimeRef.current = ctx.currentTime - offset;
      setPlaybackState('playing');

      source.onended = () => {
        setPlaybackState('idle');
        setCurrentTime(0);
        pauseOffsetRef.current = 0;
      };
    },
    [stop]
  );

  const handlePlay = () => {
    if (!audioDataRef.current) return;
    startPlayback(pauseOffsetRef.current);
  };

  const handlePause = () => {
    const ctx = audioContextRef.current;
    if (!ctx || !sourceRef.current) return;

    pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;
    stop();
    setPlaybackState('paused');
  };

  const handleSeek = (value: number | readonly number[]) => {
    const time = Array.isArray(value) ? value[0] : value;
    setCurrentTime(time);
    pauseOffsetRef.current = time;
    if (playbackState === 'playing') {
      startPlayback(time);
    }
  };

  const handleDownload = () => {
    if (!hex) return;
    if (onDownload) {
      onDownload(hex);
      return;
    }
    const blob = new Blob(
      [new Uint8Array(hexToArrayBuffer(hex))],
      { type: format === 'mp3' ? 'audio/mpeg' : `audio/${format}` }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audio.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Progress update
  useEffect(() => {
    if (playbackState !== 'playing') return;
    const id = setInterval(() => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      setCurrentTime(Math.min(ctx.currentTime - startTimeRef.current, duration));
    }, 200);
    return () => clearInterval(id);
  }, [playbackState, duration]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!webAudioSupported) {
    return (
      <Box display="grid" gap={3}>
        <Box bg="surface.inset" borderRadius="md" px="14px" py="12px" color="content.readout" fontSize="label">
          Web Audio API is not supported in this browser. Audio playback is unavailable.
        </Box>
        {showDownload && (
          <Button variant="outline" onClick={handleDownload} disabled={!hex}>
            {downloadLabel}
          </Button>
        )}
      </Box>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playing = playbackState === 'playing';

  return (
    <Box display="grid" gap="12px" justifyItems="start">
      <Box bg="transport.bg" color="transport.text" borderRadius="md" px="16px" py="14px" display="grid" gap="10px" width="100%">
        <Box fontSize="0.9375rem" fontWeight={700} lineHeight="1.3" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {title}
        </Box>

        {playbackState === 'error' && (
          <Box color="state.errBright" fontSize="label">
            {errorMessage}
          </Box>
        )}

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
            value={currentTime}
            aria-label={`Seek ${title}`}
            onChange={(event) => handleSeek(Number(event.currentTarget.value))}
            disabled={!audioDataRef.current}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }}
          />
        </Box>

        <Box display="flex" alignItems="center" gap="2px" aria-hidden="true">
          {ticks.map((tick) => (
            <Box key={tick} flex="1 1 0" h={tick % 7 === 0 ? '7px' : '4px'} bg="transport.text" opacity={0.35} />
          ))}
        </Box>

        <Box display="flex" alignItems="center" justifyContent="space-between" gap={4}>
          <button
            type="button"
            onClick={playing ? handlePause : handlePlay}
            disabled={playbackState === 'loading' || !audioDataRef.current}
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 0, color: 'var(--chakra-colors-transport-text)', cursor: 'pointer', font: 'inherit', fontSize: 'var(--chakra-font-sizes-label)', fontWeight: 700, padding: 0 }}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} />
            {playing ? 'Pause' : 'Play'}
          </button>
          <Box fontFamily="mono" fontSize="mono" color="transport.text" fontVariantNumeric="tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Box>
        </Box>
      </Box>

      {showDownload && (
        <Button variant="outline" onClick={handleDownload} disabled={!hex}>
          {downloadLabel}
        </Button>
      )}
    </Box>
  );
}
