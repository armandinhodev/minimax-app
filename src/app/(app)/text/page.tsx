'use client';

/**
 * Chat Studio — MiniMax text models.
 *
 * One canonical conversation, four upstream surfaces. The surface selector
 * picks which MiniMax endpoint the app talks to:
 * - native:    POST /v1/text/chatcompletion_v2
 * - openai:    POST /v1/chat/completions
 * - anthropic: POST /anthropic/v1/messages
 * - responses: POST /v1/responses
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { authFetch } from '@/lib/auth-client';

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'MiniMax-M3.1-Flash', label: 'MiniMax-M3.1-Flash' },
  { value: 'MiniMax-M3', label: 'MiniMax-M3' },
];

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

export default function TextPage() {
  const [model, setModel] = useState('MiniMax-M3.1-Flash');
  const [surface, setSurface] = useState('native');
  const [system, setSystem] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !isSending && input.trim().length > 0;

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

    const conversation = [...messages, { role: 'user' as const, text: prompt }];
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

  return (
    <Box display="grid" gap={6} width="100%">
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box maxW="52rem">
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Chat Studio</h1>
          <Box color="gray.600" mt={1}>
            Talk to MiniMax M3 models. The same conversation can run against the native endpoint
            or any of the OpenAI, Anthropic and Responses compatible surfaces.
          </Box>
        </Box>
        <Box border="1px solid" borderColor="blue.100" borderLeft="3px solid" borderLeftColor="blue.400" borderRadius="md" bg="white" p="0.75rem" color="gray.700" fontSize="sm" maxW="24rem">
          MiniMax-M3.1-Flash and MiniMax-M3 are reasoning models: streaming is recommended.
        </Box>
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' }} gap={6} alignItems="start">
        <Card accent="blue">
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
            <CardDescription>Pick the model and the upstream surface, then send a message.</CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            <Box display="grid" gap={2}>
              <Label htmlFor="text-model">Model</Label>
              <Select
                id="text-model"
                value={model}
                options={MODEL_OPTIONS}
                disabled={isSending}
                onValueChange={setModel}
              />
            </Box>

            <Box display="grid" gap={2}>
              <Label htmlFor="text-surface">Surface</Label>
              <Select
                id="text-surface"
                value={surface}
                options={SURFACE_OPTIONS}
                disabled={isSending}
                onValueChange={setSurface}
              />
            </Box>

            <Box display="grid" gap={2}>
              <Label htmlFor="text-system">System prompt (optional)</Label>
              <Textarea
                id="text-system"
                value={system}
                disabled={isSending}
                minH="5rem"
                placeholder="You are a concise assistant."
                onChange={(event) => setSystem(event.currentTarget.value)}
              />
            </Box>

            <Box display="grid" gap={2}>
              <Label htmlFor="text-input">Message</Label>
              <Textarea
                id="text-input"
                value={input}
                disabled={isSending}
                minH="8rem"
                placeholder="Ask something, or describe an image to reason about."
                onChange={(event) => setInput(event.currentTarget.value)}
              />
            </Box>

            {error && <ErrorDisplay message={error} />}

            <Button onClick={handleSend} disabled={!canSend} colorPalette="blue">
              {isSending ? 'Thinking...' : 'Send'}
            </Button>
          </CardContent>
        </Card>

        <Card accent="green" minH="28rem">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>
              {messages.length === 0 && !reply
                ? 'Your conversation appears here.'
                : `${messages.length} message${messages.length === 1 ? '' : 's'} sent`}
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            {messages.length === 0 && !reply && !isSending && (
              <Box border="1px dashed" borderColor="gray.200" borderRadius="xl" p="2rem" textAlign="center" color="gray.600" bg="white">
                Send a message to start.
              </Box>
            )}

            {messages.map((message, index) => (
              <Box
                key={`${message.role}-${index}`}
                border="1px solid"
                borderColor={message.role === 'user' ? 'gray.200' : 'blue.100'}
                borderRadius="xl"
                bg="white"
                p="0.75rem"
              >
                <Box color="gray.500" fontSize="0.75rem" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em">
                  {message.role}
                </Box>
                <Box color="gray.800" whiteSpace="pre-wrap" mt={1}>
                  {message.text}
                </Box>
              </Box>
            ))}

            {reply && (
              <Box border="1px solid" borderColor="green.100" borderRadius="xl" bg="white" p="0.75rem">
                <Box color="gray.500" fontSize="0.75rem" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em">
                  assistant
                </Box>

                {reply.reasoningContent && (
                  <Box
                    mt={2}
                    border="1px dashed"
                    borderColor="purple.200"
                    borderRadius="lg"
                    p="0.6rem"
                    color="gray.600"
                    fontSize="0.85rem"
                    whiteSpace="pre-wrap"
                  >
                    <Box fontWeight={700} color="purple.700" fontSize="0.75rem" mb={1}>
                      Thinking
                    </Box>
                    {reply.reasoningContent}
                  </Box>
                )}

                <Box color="gray.800" whiteSpace="pre-wrap" mt={2}>
                  {reply.content}
                </Box>

                {reply.toolCalls && reply.toolCalls.length > 0 && (
                  <Box display="grid" gap="0.5rem" mt={2}>
                    {reply.toolCalls.map((call) => (
                      <Box key={call.id} border="1px solid" borderColor="teal.200" borderRadius="lg" p="0.5rem">
                        <Box fontSize="0.8rem" fontWeight={700} color="teal.700">
                          {call.name}
                        </Box>
                        <Box as="pre" fontSize="0.75rem" whiteSpace="pre-wrap" color="gray.600" m={0}>
                          {call.arguments}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                {reply.usage && (
                  <Box color="gray.500" fontSize="0.78rem" mt={2}>
                    {reply.usage.inputTokens !== undefined && <>Input {reply.usage.inputTokens} tokens · </>}
                    {reply.usage.outputTokens !== undefined && <>Output {reply.usage.outputTokens} tokens</>}
                    {reply.finishReason && <> · {reply.finishReason}</>}
                  </Box>
                )}
              </Box>
            )}

            {isSending && !reply && (
              <Box border="1px dashed" borderColor="blue.200" borderRadius="xl" p="1.5rem" textAlign="center" color="gray.600" bg="white">
                MiniMax is thinking.
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
