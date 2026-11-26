/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpeechWebSocketClient } from './SpeechWebSocketClient';

vi.mock('server-only', () => ({}));

const REQUEST = {
  text: 'Hola mundo',
  voiceId: 'English_radiant_girl',
  model: 'speech-2.8-hd' as const,
  speed: 1,
  volume: 1,
  pitch: 0,
  format: 'mp3' as const,
  sampleRate: 32000 as const,
  channel: 1 as const,
};

type Listener = (event: unknown) => void;

/** Minimal stand-in for the global WebSocket, driven by the test. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly options: unknown;
  readonly sent: string[] = [];
  readyState = 0;
  closed = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string, options?: unknown) {
    this.url = url;
    this.options = options;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }

  emit(type: string, payload?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  emitOpen() {
    this.readyState = 1;
    this.emit('open', {});
  }

  emitMessage(data: string) {
    this.emit('message', { data });
  }
}

function installFakeWebSocket() {
  const original = globalThis.WebSocket;
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  return {
    restore: () => {
      (globalThis as { WebSocket: unknown }).WebSocket = original;
    },
    latest: () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1],
  };
}

function tick(times = 4) {
  let chain = Promise.resolve();
  for (let i = 0; i < times; i += 1) {
    chain = chain.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return chain;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

describe('SpeechWebSocketClient', () => {
  let socket: ReturnType<typeof installFakeWebSocket>;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    socket = installFakeWebSocket();
  });

  afterEach(() => {
    socket.restore();
    vi.restoreAllMocks();
  });

  it('opens the documented socket with the api key', async () => {
    void new SpeechWebSocketClient().synthesize(REQUEST);
    await tick(2);

    const ws = socket.latest();
    expect(ws.url).toBe('wss://api.minimax.io/ws/v1/t2a_v2');
    expect(JSON.stringify(ws.options)).toContain('Bearer test-minimax-key');
  });

  it('performs the handshake and relays the audio in the upstream shape', async () => {
    const streamPromise = new SpeechWebSocketClient().synthesize(REQUEST);
    await tick(2);

    const ws = socket.latest();
    ws.emitOpen();
    ws.emitMessage(JSON.stringify({ event: 'connected_success', session_id: 's1' }));
    await tick(3);

    ws.emitMessage(JSON.stringify({ event: 'task_started', session_id: 's1' }));
    await tick(3);

    ws.emitMessage(JSON.stringify({
      data: { audio: 'deadbeef' },
      extra_info: { usage_characters: 42, word_count: 7 },
    }));
    ws.emitMessage(JSON.stringify({ event: 'task_finished' }));
    await tick(4);

    const stream = await streamPromise;
    const text = await readAll(stream);

    expect(text).toContain('"audio":"deadbeef"');
    expect(text).toContain('"usage_characters":42');

    const events = ws.sent.map((raw) => (JSON.parse(raw) as { event: string }).event);
    expect(events).toEqual(['task_start', 'task_continue']);

    const start = JSON.parse(ws.sent[0]) as {
      model: string;
      voice_setting: { voice_id: string };
      audio_setting: { format: string };
    };
    expect(start.model).toBe('speech-2.8-hd');
    expect(start.voice_setting.voice_id).toBe('English_radiant_girl');
    expect(start.audio_setting.format).toBe('mp3');

    const continueEvent = JSON.parse(ws.sent[1]) as { event: string; text: string };
    expect(continueEvent.text).toBe('Hola mundo');
  });

  it('reports a failed task as an error chunk', async () => {
    const streamPromise = new SpeechWebSocketClient().synthesize(REQUEST);
    await tick(2);

    const ws = socket.latest();
    ws.emitOpen();
    ws.emitMessage(JSON.stringify({ event: 'connected_success' }));
    await tick(3);
    ws.emitMessage(JSON.stringify({ event: 'task_started' }));
    await tick(3);
    ws.emitMessage(JSON.stringify({
      event: 'task_failed',
      base_resp: { status_code: 1004, status_msg: 'api key invalid' },
    }));
    await tick(4);

    const stream = await streamPromise;
    const text = await readAll(stream);

    expect(text).toContain('"error"');
    expect(text).toContain('api key invalid');
  });

  it('rejects when the handshake does not complete', async () => {
    const promise = new SpeechWebSocketClient().synthesize(REQUEST);
    await tick(2);

    const ws = socket.latest();
    ws.emitOpen();
    ws.emitMessage(JSON.stringify({
      event: 'task_failed',
      base_resp: { status_code: 1004, status_msg: 'api key invalid' },
    }));

    await expect(promise).rejects.toThrow('api key invalid');
  });
});
