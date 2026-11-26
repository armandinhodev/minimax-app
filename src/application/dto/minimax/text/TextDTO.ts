/**
 * Text DTOs — contratos de las cuatro superficies de texto de MiniMax.
 *
 * Fuentes oficiales (leídas 2026-11-26):
 * - /v1/text/chatcompletion_v2  (nativa)
 * - /v1/chat/completions        (compatible OpenAI)
 * - /anthropic/v1/messages      (compatible Anthropic)
 * - /v1/responses               (compatible OpenAI Responses)
 * - /v1/models, /v1/models/{id} (catálogo)
 *
 * La app usa una forma interna canónica y el cliente la traduce a cada
 * superficie. La app nunca ve los formatos específicos de cada una.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- *
 * Vocabularios
 * -------------------------------------------------------------------------- */

export const TEXT_MODELS = ['MiniMax-M3.1-Flash', 'MiniMax-M3'] as const;
export type TextModel = (typeof TEXT_MODELS)[number];
export const TextModelSchema = z.enum(TEXT_MODELS);

export const TEXT_ROLES = ['system', 'user', 'assistant', 'tool'] as const;
export type TextRole = (typeof TEXT_ROLES)[number];
export const TextRoleSchema = z.enum(TEXT_ROLES);

/**
 * Vocabulario de fin de generación, con el de cada superficie:
 * - nativa / OpenAI: `stop`, `length`, `content_filter`, `tool_calls`
 * - Anthropic: `end_turn`, `max_tokens`, `tool_use`, `pause_turn`
 */
export const TEXT_FINISH_REASONS = [
  'stop',
  'length',
  'content_filter',
  'tool_calls',
  'end_turn',
  'max_tokens',
  'tool_use',
  'pause_turn',
] as const;
export type TextFinishReason = (typeof TEXT_FINISH_REASONS)[number];

/** Superficies upstream soportadas. */
export const TEXT_SURFACES = ['native', 'openai', 'anthropic', 'responses'] as const;
export type TextSurface = (typeof TEXT_SURFACES)[number];
export const TextSurfaceSchema = z.enum(TEXT_SURFACES);

/** Rutas upstream por superficie. */
export const TEXT_SURFACE_PATHS: Record<TextSurface, string> = {
  native: '/v1/text/chatcompletion_v2',
  openai: '/v1/chat/completions',
  anthropic: '/anthropic/v1/messages',
  responses: '/v1/responses',
};

/**
 * `max_tokens` es obligatorio en la superficie Anthropic. La doc recomienda
 * 131072 para los modelos M3 y fija el máximo en 524288.
 */
export const TEXT_DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const TEXT_MAX_OUTPUT_TOKENS = 524288;

/* -------------------------------------------------------------------------- *
 * Forma interna canónica
 * -------------------------------------------------------------------------- */

/** Parte de contenido: texto o imagen. */
export interface TextContentPart {
  type: 'text' | 'image_url';
  text?: string;
  /** URL http(s) o data URL de la imagen. */
  imageUrl?: string;
}

/** Llamada a herramienta emitida por el modelo. */
export interface TextToolCall {
  id: string;
  name: string;
  /** Argumentos serializados como JSON. */
  arguments: string;
}

/** Definición de herramienta ofrecida al modelo. */
export interface TextToolDefinition {
  name: string;
  description: string;
  /** JSON Schema de los parámetros. */
  parameters: unknown;
}

/** Mensaje de la conversación. */
export interface TextMessage {
  role: TextRole;
  content: string | TextContentPart[];
  /** Solo en mensajes de assistant. */
  toolCalls?: TextToolCall[];
  /** Solo en mensajes de tool: id de la llamada a la que responde. */
  toolCallId?: string;
}

/** Opciones de una completación. */
export interface ChatCompletionOptions {
  model: TextModel;
  system?: string;
  messages: TextMessage[];
  maxCompletionTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: TextToolDefinition[];
  toolChoice?: 'auto';
  maskSensitiveInfo?: boolean;
}

/** Resultado normalizado de una completación. */
export interface ChatCompletionResult {
  id: string;
  model: string;
  content: string;
  /** Contenido de razonamiento, cuando la superficie lo expone. */
  reasoningContent?: string;
  toolCalls?: TextToolCall[];
  finishReason?: TextFinishReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
  };
  inputSensitive?: boolean;
  outputSensitive?: boolean;
}

/** Entrada del catálogo de modelos. */
export interface TextModelDTO {
  id: string;
  created?: number;
  ownedBy?: string;
}

/** Resultado de estimar tokens de entrada. */
export interface InputTokensEstimate {
  inputTokens: number;
}

/* -------------------------------------------------------------------------- *
 * Validación de la request
 * -------------------------------------------------------------------------- */

const ContentPartSchema = z.object({
  type: z.enum(['text', 'image_url']),
  text: z.string().optional(),
  imageUrl: z.string().optional(),
});

const ToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.string(),
});

const MessageSchema = z.object({
  role: TextRoleSchema,
  content: z.union([z.string(), z.array(ContentPartSchema)]),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolCallId: z.string().optional(),
});

const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  parameters: z.unknown(),
});

export const ChatCompletionRequestSchema = z
  .object({
    model: TextModelSchema.default('MiniMax-M3.1-Flash'),
    system: z.string().max(100_000).optional(),
    messages: z.array(MessageSchema).min(1, 'At least one message is required'),
    maxCompletionTokens: z.number().int().min(1).max(TEXT_MAX_OUTPUT_TOKENS).optional(),
    temperature: z.number().gt(0).max(1).optional(),
    topP: z.number().gt(0).max(1).optional(),
    tools: z.array(ToolDefinitionSchema).optional(),
    toolChoice: z.literal('auto').optional(),
    maskSensitiveInfo: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.toolChoice && !value.tools?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['toolChoice'],
        message: 'toolChoice requires at least one tool definition',
      });
    }

    value.messages.forEach((message, index) => {
      if (message.role === 'tool' && !message.toolCallId) {
        ctx.addIssue({
          code: 'custom',
          path: ['messages', index, 'toolCallId'],
          message: 'A tool message must reference the tool call it answers',
        });
      }

      if (Array.isArray(message.content)) {
        const hasText = message.content.some((part) => part.type === 'text' && part.text?.trim());
        if (!hasText) {
          ctx.addIssue({
            code: 'custom',
            path: ['messages', index, 'content'],
            message: 'A message must include at least one non-empty text part',
          });
        }
      }
    });
  });

export type ChatCompletionRequestInput = z.input<typeof ChatCompletionRequestSchema>;
export type ChatCompletionRequestParsed = z.output<typeof ChatCompletionRequestSchema>;

/* -------------------------------------------------------------------------- *
 * Mapeo hacia las superficies upstream
 * -------------------------------------------------------------------------- */

/** Convierte las partes internas al formato multimodal nativo/OpenAI. */
function toNativeContent(content: TextMessage['content']): unknown {
  if (typeof content === 'string') return content;

  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text ?? '' };
    }
    return { type: 'image_url', image_url: { url: part.imageUrl ?? '' } };
  });
}

/** Body de las superficies nativa y compatible OpenAI. */
export function toChatCompletionBody(
  request: ChatCompletionOptions,
  options: { stream?: boolean; includeUsage?: boolean } = {},
): Record<string, unknown> {
  const messages = request.messages.map((message) => ({
    role: message.role,
    content: toNativeContent(message.content),
    ...(message.toolCalls?.length
      ? {
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      }
      : {}),
    ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
  }));

  const body: Record<string, unknown> = {
    model: request.model,
    messages,
  };

  if (request.system) {
    messages.unshift({ role: 'system', content: request.system });
  }
  if (request.maxCompletionTokens) body.max_completion_tokens = request.maxCompletionTokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.tools?.length) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
  if (request.toolChoice) body.tool_choice = request.toolChoice;
  if (request.maskSensitiveInfo !== undefined) body.mask_sensitive_info = request.maskSensitiveInfo;
  if (options.stream) body.stream = true;
  if (options.includeUsage) body.stream_options = { include_usage: true };

  return body;
}

/**
 * Body de la superficie Anthropic.
 *
 * El prompt de sistema viaja en el campo de nivel superior `system`: no
 * existe un rol `system` entre los mensajes.
 */
export function toAnthropicBody(
  request: ChatCompletionOptions,
  options: { stream?: boolean } = {},
): Record<string, unknown> {
  const messages = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: toAnthropicContent(message),
    }));

  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    max_tokens: request.maxCompletionTokens ?? TEXT_DEFAULT_MAX_OUTPUT_TOKENS,
  };

  if (request.system) body.system = request.system;
  if (request.tools?.length) {
    body.tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }
  if (request.toolChoice) body.tool_choice = { type: request.toolChoice };
  if (options.stream) body.stream = true;

  return body;
}

function toAnthropicContent(message: TextMessage): unknown {
  if (typeof message.content === 'string') {
    return message.role === 'tool'
      ? [{ type: 'tool_result', tool_use_id: message.toolCallId ?? '', content: message.content }]
      : message.content;
  }

  const blocks = message.content.map((part) =>
    part.type === 'text'
      ? { type: 'text', text: part.text ?? '' }
      : { type: 'image', source: { type: 'url', url: part.imageUrl ?? '' } },
  );

  if (message.role === 'tool') {
    return [{ type: 'tool_result', tool_use_id: message.toolCallId ?? '', content: blocks }];
  }

  return blocks;
}

/** Body de la superficie OpenAI Responses. */
export function toResponsesBody(
  request: ChatCompletionOptions,
  options: { stream?: boolean } = {},
): Record<string, unknown> {
  const input = request.messages.map((message) => ({
    type: 'message',
    role: message.role === 'system' ? 'developer' : message.role,
    content: typeof message.content === 'string'
      ? message.content
      : message.content.map((part) =>
        part.type === 'text'
          ? { type: 'input_text', text: part.text ?? '' }
          : { type: 'input_image', image_url: part.imageUrl ?? '' },
      ),
  }));

  const body: Record<string, unknown> = {
    model: request.model,
    input,
  };

  if (request.system) body.instructions = request.system;
  if (request.maxCompletionTokens) body.max_output_tokens = request.maxCompletionTokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.tools?.length) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
  if (request.toolChoice) body.tool_choice = request.toolChoice;
  if (options.stream) body.stream = true;

  return body;
}

/* -------------------------------------------------------------------------- *
 * Normalización de respuestas
 * -------------------------------------------------------------------------- */

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Normaliza la respuesta nativa y la compatible OpenAI. */
export function fromChatCompletionPayload(payload: unknown): ChatCompletionResult {
  const raw = payload as Record<string, unknown> | undefined;
  const choices = Array.isArray(raw?.choices) ? raw.choices : [];
  const choice = (choices[0] ?? {}) as Record<string, unknown>;
  const message = (choice.message ?? {}) as Record<string, unknown>;

  const result: ChatCompletionResult = {
    id: readString(raw?.id) ?? '',
    model: readString(raw?.model) ?? '',
    content: readString(message.content) ?? '',
  };

  const reasoning = readString(message.reasoning_content);
  if (reasoning) result.reasoningContent = reasoning;

  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  if (toolCalls.length > 0) {
    result.toolCalls = toolCalls.flatMap((call) => {
      const item = call as Record<string, unknown>;
      const fn = (item.function ?? {}) as Record<string, unknown>;
      const id = readString(item.id);
      const name = readString(fn.name);
      if (!id || !name) return [];
      return [{ id, name, arguments: typeof fn.arguments === 'string' ? fn.arguments : '{}' }];
    });
  }

  const finishReason = readString(choice.finish_reason);
  if (finishReason && (TEXT_FINISH_REASONS as readonly string[]).includes(finishReason)) {
    result.finishReason = finishReason as TextFinishReason;
  }

  const usage = (raw?.usage ?? {}) as Record<string, unknown>;
  const details = (usage.completion_tokens_details ?? {}) as Record<string, unknown>;
  const inputTokens = readNumber(usage.prompt_tokens);
  const outputTokens = readNumber(usage.completion_tokens);
  const totalTokens = readNumber(usage.total_tokens);
  const reasoningTokens = readNumber(details.reasoning_tokens);
  if (inputTokens || outputTokens || totalTokens || reasoningTokens) {
    result.usage = {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(totalTokens !== undefined ? { totalTokens } : {}),
      ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    };
  }

  const inputSensitive = readNumber(raw?.input_sensitive);
  const outputSensitive = readNumber(raw?.output_sensitive);
  if (inputSensitive !== undefined) result.inputSensitive = inputSensitive !== 0;
  if (outputSensitive !== undefined) result.outputSensitive = outputSensitive !== 0;

  return result;
}

/** Normaliza la respuesta de la superficie Anthropic. */
export function fromAnthropicPayload(payload: unknown): ChatCompletionResult {
  const raw = payload as Record<string, unknown> | undefined;
  const blocks = Array.isArray(raw?.content) ? raw.content : [];

  let content = '';
  let reasoning = '';
  const toolCalls: TextToolCall[] = [];

  for (const block of blocks) {
    const item = block as Record<string, unknown>;
    if (item.type === 'text') {
      content += readString(item.text) ?? '';
    } else if (item.type === 'thinking') {
      reasoning += readString(item.thinking) ?? '';
    } else if (item.type === 'tool_use') {
      const id = readString(item.id);
      const name = readString(item.name);
      if (id && name) {
        toolCalls.push({
          id,
          name,
          arguments: JSON.stringify(item.input ?? {}),
        });
      }
    }
  }

  const usage = (raw?.usage ?? {}) as Record<string, unknown>;
  const inputTokens = readNumber(usage.input_tokens);
  const outputTokens = readNumber(usage.output_tokens);

  const result: ChatCompletionResult = {
    id: readString(raw?.id) ?? '',
    model: readString(raw?.model) ?? '',
    content,
  };

  if (reasoning) result.reasoningContent = reasoning;
  if (toolCalls.length > 0) result.toolCalls = toolCalls;

  const stopReason = readString(raw?.stop_reason);
  if (stopReason && (TEXT_FINISH_REASONS as readonly string[]).includes(stopReason)) {
    result.finishReason = stopReason as TextFinishReason;
  }

  if (inputTokens !== undefined || outputTokens !== undefined) {
    result.usage = {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(inputTokens !== undefined && outputTokens !== undefined
        ? { totalTokens: inputTokens + outputTokens }
        : {}),
    };
  }

  return result;
}

/** Normaliza la respuesta de la superficie OpenAI Responses. */
export function fromResponsesPayload(payload: unknown): ChatCompletionResult {
  const raw = payload as Record<string, unknown> | undefined;
  const output = Array.isArray(raw?.output) ? raw.output : [];

  let content = '';
  let reasoning = '';
  const toolCalls: TextToolCall[] = [];

  for (const item of output) {
    const entry = item as Record<string, unknown>;
    if (entry.type === 'reasoning') {
      const summary = Array.isArray(entry.summary) ? entry.summary : [];
      for (const part of summary) {
        const text = readString((part as Record<string, unknown>)?.text);
        if (text) reasoning += text;
      }
      continue;
    }

    if (entry.type === 'function_call') {
      const id = readString(entry.call_id) ?? readString(entry.id);
      const name = readString(entry.name);
      if (id && name) {
        toolCalls.push({ id, name, arguments: readString(entry.arguments) ?? '{}' });
      }
      continue;
    }

    const parts = Array.isArray(entry.content) ? entry.content : [];
    for (const part of parts) {
      const text = readString((part as Record<string, unknown>)?.text);
      if (text) content += text;
    }
  }

  const usage = (raw?.usage ?? {}) as Record<string, unknown>;
  const outputDetails = (usage.output_tokens_details ?? {}) as Record<string, unknown>;
  const inputTokens = readNumber(usage.input_tokens);
  const outputTokens = readNumber(usage.output_tokens);
  const totalTokens = readNumber(usage.total_tokens);
  const reasoningTokens = readNumber(outputDetails.reasoning_tokens);

  const result: ChatCompletionResult = {
    id: readString(raw?.id) ?? '',
    model: readString(raw?.model) ?? '',
    content: content || (readString(raw?.output_text) ?? ''),
  };

  if (reasoning) result.reasoningContent = reasoning;
  if (toolCalls.length > 0) result.toolCalls = toolCalls;

  const status = readString(raw?.status);
  if (status === 'completed') result.finishReason = 'stop';
  if (status === 'incomplete') result.finishReason = 'length';

  if (inputTokens || outputTokens || totalTokens || reasoningTokens) {
    result.usage = {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(totalTokens !== undefined ? { totalTokens } : {}),
      ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    };
  }

  return result;
}
