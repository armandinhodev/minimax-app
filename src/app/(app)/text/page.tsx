'use client';

/**
 * Chat Studio — MiniMax text models.
 *
 * A conversation canvas, not a parameter sheet: the thread scrolls, the
 * composer stays at the foot, and the endpoint configuration lives behind a
 * compact Settings disclosure. Four upstream surfaces share one thread:
 * - native:    POST /v1/text/chatcompletion_v2
 * - openai:    POST /v1/chat/completions
 * - anthropic: POST /anthropic/v1/messages
 * - responses: POST /v1/responses
 */

import { useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { DictationButton } from '@/components/chat/DictationButton';
import { Icon } from '@/components/ui/icons';
import { Label } from '@/components/ui/label';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { authFetch } from '@/lib/auth-client';
import { useScreenState } from '@/components/shared/screen-state';
import { Field, Spec, SpecList } from '@/components/ui/spec';
import { Markdown } from '@/components/chat/Markdown';
import { nextConversation, type ChatMessage } from './conversation';

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'MiniMax-M3.1-Flash', label: 'M3.1 Flash' },
  { value: 'MiniMax-M3', label: 'M3' },
];

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
};

const SURFACE_OPTIONS: SelectOption[] = [
  { value: 'native', label: 'Native — /v1/text/chatcompletion_v2' },
  { value: 'openai', label: 'OpenAI — /v1/chat/completions' },
  { value: 'anthropic', label: 'Anthropic — /anthropic/v1/messages' },
  { value: 'responses', label: 'Responses — /v1/responses' },
];

/** App route per upstream surface. */
const SURFACE_ROUTES: Record<string, string> = {
  native: '/api/minimax/text/chat/completions/stream',
  openai: '/api/minimax/text/chat/completions/stream',
  anthropic: '/api/minimax/text/messages',
  responses: '/api/minimax/text/responses',
};

interface ToolCallView {
  id: string;
  name: string;
  arguments: string;
}

interface AssistantReply {
  content: string;
  reasoningContent?: string;
  toolCalls?: ToolCallView[];
  finishReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

function AssistantBlock({ reply }: { reply: AssistantReply }) {
  return (
    <Box display="grid" gap="8px">
      <Box display="flex" alignItems="center" gap="8px">
        <Box
          aria-hidden="true"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="28px"
          h="28px"
          bg="surface.inset"
          border="1px solid"
          borderColor="surface.separator"
          borderRadius="md"
          color="content.readout"
        >
          <Icon name="chat" size={15} />
        </Box>
        <Box fontSize="label" fontWeight={700} color="content.ink">
          Assistant
        </Box>
      </Box>

      {reply.reasoningContent && (
        <Box as="details" border="1px solid" borderColor="surface.separator" borderRadius="md" px="12px" py="8px">
          <Box as="summary" cursor="pointer" fontSize="help" color="content.readout">
            Reasoning
          </Box>
          <Box mt="6px" color="content.readout" fontSize="help" lineHeight="help" whiteSpace="pre-wrap">
            {reply.reasoningContent}
          </Box>
        </Box>
      )}

      {reply.content && (
        <Markdown content={reply.content} />
      )}

      {reply.toolCalls && reply.toolCalls.length > 0 && (
        <Box display="grid" gap="6px">
          {reply.toolCalls.map((call) => (
            <Box key={call.id} border="1px solid" borderColor="surface.separator" borderRadius="md" p="10px">
              <Box fontSize="help" fontWeight={700} color="interaction.accent">
                {call.name}
              </Box>
              <Box as="pre" fontSize="0.75rem" whiteSpace="pre-wrap" color="content.readout" m={0}>
                {call.arguments}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {(reply.usage || reply.finishReason) && (
        <Box as="details">
          <Box as="summary" cursor="pointer" fontSize="help" color="content.readout">
            Usage
          </Box>
          <SpecList mt="6px">
            {reply.usage?.inputTokens !== undefined && <Spec label="Input tokens" value={String(reply.usage.inputTokens)} />}
            {reply.usage?.outputTokens !== undefined && <Spec label="Output tokens" value={String(reply.usage.outputTokens)} />}
            {reply.finishReason && <Spec label="Finish reason" value={reply.finishReason} />}
          </SpecList>
        </Box>
      )}
    </Box>
  );
}

export default function TextPage() {
  const [model, setModel] = useScreenState<string>('chat:model', 'MiniMax-M3.1-Flash');
  const [surface, setSurface] = useScreenState<string>('chat:surface', 'native');
  const [system, setSystem] = useScreenState<string>('chat:system', '');
  const [input, setInput] = useScreenState<string>('chat:input', '');
  const [messages, setMessages] = useScreenState<ChatMessage[]>('chat:messages', []);
  const [reply, setReply] = useScreenState<AssistantReply | null>('chat:reply', null);
  const [isSending, setIsSending] = useScreenState<boolean>('chat:sending', false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = !isSending && !isDictating && input.trim().length > 0;

  useEffect(() => {
    const node = endRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'end' });
    }
  }, [messages, reply?.content, reply?.reasoningContent, isSending]);

  /** Extrae el texto incremental de un chunk SSE de chat completion. */
  const readStreamDelta = (chunk: string): { content: string; reasoning: string } => {
    let content = '';
    let reasoning = '';

    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice('data:'.length).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const event = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
        };
        const delta = event.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        if (delta?.reasoning_content) reasoning += delta.reasoning_content;
      } catch {
        // Ignore malformed chunks: whatever arrived so far is kept.
      }
    }

    return { content, reasoning };
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt) return;

    const conversation = nextConversation(messages, reply, prompt);
    setMessages(conversation);
    setInput('');
    setReply(null);
    setError(null);
    setIsSending(true);

    const body = {
      model,
      ...(system.trim() ? { system: system.trim() } : {}),
      messages: conversation.map((message) => ({
        role: message.role,
        content: message.text,
      })),
    };

    try {
      const route = SURFACE_ROUTES[surface] ?? SURFACE_ROUTES.native;

      if (surface === 'native' || surface === 'openai') {
        const response = await authFetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { error?: string } | null;
          setError(errorBody?.error ?? `The request failed (HTTP ${response.status}).`);
          return;
        }

        if (!response.body) {
          setError('The stream came back empty.');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        let reasoning = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const delta = readStreamDelta(chunk);
            if (delta.content) {
              content += delta.content;
              setReply((current) => ({ ...(current ?? { content: '' }), content }));
            }
            if (delta.reasoning) {
              reasoning += delta.reasoning;
              setReply((current) => ({
                ...(current ?? { content: '' }),
                content: content,
                reasoningContent: reasoning,
              }));
            }

            boundary = buffer.indexOf('\n\n');
          }
        }

        setReply((current) => ({ ...(current ?? { content: '' }), content }));
        return;
      }

      const response = await authFetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null;
        setError(errorBody?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      const result = await response.json() as AssistantReply;
      setReply(result);
    } catch {
      setError('Failed to reach MiniMax. Check your connection and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const newChat = () => {
    if (isSending) return;
    setMessages([]);
    setReply(null);
    setInput('');
    setError(null);
  };

  const applyTranscript = (text: string) => {
    setInput((current) => {
      if (!current) return text;
      return current + (/\s$/.test(current) ? '' : ' ') + text;
    });
    inputRef.current?.focus();
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      height={{ base: 'calc(100dvh - 5.75rem)', md: 'calc(100dvh - 4rem)' }}
      minH="30rem"
    >
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        gap="12px"
        flexWrap="wrap"
        pb="12px"
        borderBottom="1px solid"
        borderColor="surface.separator"
      >
        <Box display="flex" alignItems="baseline" gap="10px">
          <Box fontSize="title" lineHeight="title" fontWeight={700} letterSpacing="-0.024em">
            Chat
          </Box>
          <Box display={{ base: 'none', sm: 'block' }} color="content.readout" fontSize="help">
            {surface}
          </Box>
        </Box>

        <Box display="flex" gap="8px" flexWrap="wrap">
          <Button variant="outline" onClick={newChat} disabled={isSending}>
            New chat
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen((current) => !current)}
            aria-expanded={isSettingsOpen}
            aria-controls="chat-settings"
          >
            {isSettingsOpen ? 'Hide settings' : 'Settings'}
          </Button>
        </Box>
      </Box>

      {isSettingsOpen && (
        <Box
          id="chat-settings"
          mt="16px"
          bg="surface.sheet"
          border="1px solid"
          borderColor="surface.separator"
          borderRadius="lg"
          p="16px"
          display="grid"
          gap="12px"
        >
          <Box display="grid" gap="12px" gridTemplateColumns={{ base: '1fr', md: 'minmax(0, 20rem) minmax(0, 1fr)' }}>
            <Field label="Surface" htmlFor="text-surface">
              <Select
                id="text-surface"
                value={surface}
                options={SURFACE_OPTIONS}
                disabled={isSending}
                onValueChange={setSurface}
              />
            </Field>
            <Field label="System prompt" htmlFor="text-system">
              <Textarea
                id="text-system"
                value={system}
                disabled={isSending}
                minH="72px"
                placeholder="You are a concise studio assistant."
                onChange={(event) => setSystem(event.currentTarget.value)}
              />
            </Field>
          </Box>
          <Box color="content.readout" fontSize="help" lineHeight="help">
            The surface selects the upstream endpoint. The system prompt applies to every message in the thread.
          </Box>
        </Box>
      )}

      <Box flex="1 1 auto" minH={0} overflowY="auto">
        <Box maxW="48rem" mx="auto" height="100%" display="flex" flexDirection="column" gap="24px" py="24px">
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <Box
                key={`${message.role}-${index}`}
                justifySelf="end"
                maxW="80%"
                bg="interaction.soft"
                borderRadius="lg"
                px="16px"
                py="12px"
                color="content.ink"
                fontSize="body"
                lineHeight="1.6"
                whiteSpace="pre-wrap"
              >
                {message.text}
              </Box>
            ) : (
              <AssistantBlock key={`${message.role}-${index}`} reply={{ content: message.text }} />
            ),
          )}

          {reply && <AssistantBlock reply={reply} />}

          {isSending && !reply && (
            <Box display="flex" alignItems="center" gap="8px" color="content.readout" fontSize="label">
              <Box aria-hidden="true" w="6px" h="6px" borderRadius="full" bg="interaction.accent" />
              MiniMax is thinking.
            </Box>
          )}

          <div ref={endRef} />
        </Box>
      </Box>

      <Box flex="0 0 auto" pt="12px" bg="surface.field">
        <Box maxW="48rem" mx="auto" display="grid" gap="8px">
          {error && <ErrorDisplay message={error} />}

          <Box
            border="1px solid"
            borderColor="surface.rule"
            borderRadius="lg"
            bg="surface.plate"
            p="10px"
            display="grid"
            gap="6px"
            _focusWithin={{ borderColor: 'interaction.accent', boxShadow: '0 0 0 3px var(--chakra-colors-interaction-focus-ring)' }}
          >
            <Label htmlFor="text-input" style={VISUALLY_HIDDEN}>
              Message
            </Label>
            <Textarea
              ref={inputRef}
              id="text-input"
              value={input}
              disabled={isSending}
              required
              aria-required="true"
              minH="52px"
              maxH="200px"
              resize="none"
              border="none"
              bg="transparent"
              px="4px"
              py="4px"
              placeholder="Message MiniMax..."
              _focus={{ borderColor: 'transparent', boxShadow: 'none', outline: 'none' }}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Box display="flex" alignItems="center" justifyContent="space-between" gap="8px" flexWrap="wrap">
              <Box display={{ base: 'none', sm: 'block' }} color="content.readout" fontSize="help" lineHeight="help">
                Enter to send. Shift+Enter for a new line.
              </Box>

              <Box display="flex" alignItems="center" gap="8px" ml="auto">
                <Box width="150px" maxW="45vw">
                  <Label htmlFor="text-model" style={VISUALLY_HIDDEN}>
                    Model
                  </Label>
                  <Select
                    id="text-model"
                    value={model}
                    options={MODEL_OPTIONS}
                    disabled={isSending || isDictating}
                    onValueChange={setModel}
                  />
                </Box>
                <DictationButton
                  disabled={isSending}
                  onTranscript={applyTranscript}
                  onError={setError}
                  onBusyChange={(busy) => {
                    setIsDictating(busy);
                    if (busy) setError(null);
                  }}
                />
                <Button onClick={() => void handleSend()} disabled={!canSend}>
                  {isSending ? 'Sending...' : 'Send'}
                </Button>
              </Box>
            </Box>
          </Box>

          <Box aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {isSending ? 'MiniMax is responding.' : reply ? 'Response complete.' : ''}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
