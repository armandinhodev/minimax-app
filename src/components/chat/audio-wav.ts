/** Encode mono float samples as a 16-bit PCM WAV file. */
export function encodeWav(mono: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataLength = mono.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < mono.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, mono[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Decode a browser recording and turn it into a mono 16 kHz WAV.
 *
 * MiniMax ASR does not accept WebM/PCM without a container, and it does not
 * benefit from stereo or a high sample rate. The browser records whatever the
 * platform gives us (usually WebM/Opus or MP4/AAC), so it is converted here.
 */
export async function recordingToWav(blob: Blob): Promise<Blob> {
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) throw new Error('AudioContext is not available');

  const context = new AudioCtor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16_000;

    let source: AudioBuffer = decoded;
    if (decoded.sampleRate !== targetRate) {
      const Offline = window.OfflineAudioContext
        ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!Offline) throw new Error('Audio resampling is not available');

      const offline = new Offline(1, Math.ceil(decoded.duration * targetRate), targetRate);
      const node = offline.createBufferSource();
      node.buffer = decoded;
      node.connect(offline.destination);
      node.start();
      source = await offline.startRendering();
    }

    const channels = source.numberOfChannels;
    const mono = new Float32Array(source.length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = source.getChannelData(channel);
      for (let index = 0; index < source.length; index += 1) {
        mono[index] += data[index] / channels;
      }
    }

    return encodeWav(mono, targetRate);
  } finally {
    void context.close().catch(() => undefined);
  }
}
