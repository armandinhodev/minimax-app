/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  ChatCompletionRequestSchema,
  fromAnthropicPayload,
  fromChatCompletionPayload,
  fromResponsesPayload,
  TEXT_SURFACE_PATHS,
  toAnthropicBody,
  toChatCompletionBody,
  toResponsesBody,
  type ChatCompletionOptions,
} from './TextDTO';

const BASE: ChatCompletionOptions = {
  model: 'MiniMax-M3.1-Flash',
  messages: [{ role: 'user', content: 'hola' }],
};

describe('ChatCompletionRequestSchema', () => {
  it('applies the documented defaults', () => {
    const parsed = ChatCompletionRequestSchema.parse({ messages: [{ role: 'user', content: 'hola' }] });

    expect(parsed.model).toBe('MiniMax-M3.1-Flash');
  });

  it('rejects an unknown model', () => {
    expect(ChatCompletionRequestSchema.safeParse({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hola' }],
    }).success).toBe(false);
  });

  it('requires at least one message', () => {
    expect(ChatCompletionRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });

  it('requires a tool message to reference its tool call', () => {
    const result = ChatCompletionRequestSchema.safeParse({
      messages: [{ role: 'tool', content: 'resultado' }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join(' ')).toContain(
        'must reference the tool call',
      );
    }
  });

  it('rejects toolChoice without tools', () => {
    const result = ChatCompletionRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'hola' }],
      toolChoice: 'auto',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a multimodal message without text', () => {
    const result = ChatCompletionRequestSchema.safeParse({
      messages: [{ role: 'user', content: [{ type: 'image_url', imageUrl: 'https://x.test/a.png' }] }],
    });

    expect(result.success).toBe(false);
  });
});

describe('surface paths', () => {
  it('pins the documented upstream paths', () => {
    expect(TEXT_SURFACE_PATHS).toEqual({
      native: '/v1/text/chatcompletion_v2',
      openai: '/v1/chat/completions',
      anthropic: '/anthropic/v1/messages',
      responses: '/v1/responses',
    });
  });
});

describe('toChatCompletionBody', () => {
  it('maps the system prompt to a leading system message', () => {
    const body = toChatCompletionBody({ ...BASE, system: 'sos conciso' });

    expect(body.messages).toEqual([
      { role: 'system', content: 'sos conciso' },
      { role: 'user', content: 'hola' },
    ]);
  });

  it('maps multimodal content to the native parts shape', () => {
    const body = toChatCompletionBody({
      ...BASE,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'que ves?' },
          { type: 'image_url', imageUrl: 'https://x.test/a.png' },
        ],
      }],
    });

    expect(body.messages).toEqual([{
      role: 'user',
      content: [
        { type: 'text', text: 'que ves?' },
        { type: 'image_url', image_url: { url: 'https://x.test/a.png' } },
      ],
    }]);
  });

  it('maps tool definitions and tool calls', () => {
    const body = toChatCompletionBody({
      ...BASE,
      tools: [{ name: 'get_weather', description: 'clima', parameters: { type: 'object' } }],
      toolChoice: 'auto',
      messages: [{
        role: 'assistant',
        content: 'consulto',
        toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: '{"city":"SF"}' }],
      }],
    });

    expect(body.tools).toEqual([{
      type: 'function',
      function: { name: 'get_weather', description: 'clima', parameters: { type: 'object' } },
    }]);
    expect(body.tool_choice).toBe('auto');
    expect(body.messages).toEqual([{
      role: 'assistant',
      content: 'consulto',
      tool_calls: [{
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"SF"}' },
      }],
    }]);
  });

  it('sets the streaming flags only when asked', () => {
    expect(toChatCompletionBody(BASE).stream).toBeUndefined();
    expect(toChatCompletionBody(BASE, { stream: true }).stream).toBe(true);
    expect(toChatCompletionBody(BASE, { stream: true, includeUsage: true }).stream_options)
      .toEqual({ include_usage: true });
  });
});

describe('toAnthropicBody', () => {
  it('lifts the system prompt out of the messages', () => {
    const body = toAnthropicBody({ ...BASE, system: 'sos conciso' });

    expect(body.system).toBe('sos conciso');
    expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
  });

  it('always sends max_tokens, which the surface requires', () => {
    expect(toAnthropicBody(BASE).max_tokens).toBe(4096);
    expect(toAnthropicBody({ ...BASE, maxCompletionTokens: 1000 }).max_tokens).toBe(1000);
  });

  it('maps tools to the Anthropic shape', () => {
    const body = toAnthropicBody({
      ...BASE,
      tools: [{ name: 'get_weather', description: 'clima', parameters: { type: 'object' } }],
      toolChoice: 'auto',
    });

    expect(body.tools).toEqual([{
      name: 'get_weather',
      description: 'clima',
      input_schema: { type: 'object' },
    }]);
    expect(body.tool_choice).toEqual({ type: 'auto' });
  });

  it('wraps a tool result in a tool_result block', () => {
    const body = toAnthropicBody({
      ...BASE,
      messages: [{ role: 'tool', content: '22 grados', toolCallId: 'call_1' }],
    });

    expect(body.messages).toEqual([{
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '22 grados' }],
    }]);
  });
});

describe('toResponsesBody', () => {
  it('maps the system prompt to instructions and the roles to items', () => {
    const body = toResponsesBody({ ...BASE, system: 'sos conciso' });

    expect(body.instructions).toBe('sos conciso');
    expect(body.input).toEqual([{ type: 'message', role: 'user', content: 'hola' }]);
  });

  it('maps multimodal content to input parts', () => {
    const body = toResponsesBody({
      ...BASE,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'que ves?' },
          { type: 'image_url', imageUrl: 'https://x.test/a.png' },
        ],
      }],
    });

    expect(body.input).toEqual([{
      type: 'message',
      role: 'user',
      content: [
        { type: 'input_text', text: 'que ves?' },
        { type: 'input_image', image_url: 'https://x.test/a.png' },
      ],
    }]);
  });
});

describe('response normalization', () => {
  it('normalizes the native and OpenAI payload', () => {
    const result = fromChatCompletionPayload({
      id: 'resp-1',
      model: 'MiniMax-M3.1-Flash',
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: 'consulto el clima',
          reasoning_content: 'pensando...',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"SF"}' },
          }],
        },
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        completion_tokens_details: { reasoning_tokens: 5 },
      },
      input_sensitive: 0,
      output_sensitive: 1,
    });

    expect(result).toEqual({
      id: 'resp-1',
      model: 'MiniMax-M3.1-Flash',
      content: 'consulto el clima',
      reasoningContent: 'pensando...',
      toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: '{"city":"SF"}' }],
      finishReason: 'tool_calls',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, reasoningTokens: 5 },
      inputSensitive: false,
      outputSensitive: true,
    });
  });

  it('normalizes the Anthropic payload', () => {
    const result = fromAnthropicPayload({
      id: 'msg-1',
      type: 'message',
      role: 'assistant',
      model: 'MiniMax-M3.1-Flash',
      content: [
        { type: 'thinking', thinking: 'razonando', signature: 'sig' },
        { type: 'text', text: 'la respuesta' },
        { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'SF' } },
      ],
      usage: { input_tokens: 8, output_tokens: 12 },
      stop_reason: 'tool_use',
    });

    expect(result).toEqual({
      id: 'msg-1',
      model: 'MiniMax-M3.1-Flash',
      content: 'la respuesta',
      reasoningContent: 'razonando',
      toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: '{"city":"SF"}' }],
      finishReason: 'tool_use',
      usage: { inputTokens: 8, outputTokens: 12, totalTokens: 20 },
    });
  });

  it('normalizes the Responses payload', () => {
    const result = fromResponsesPayload({
      id: 'resp-2',
      object: 'response',
      model: 'MiniMax-M3.1-Flash',
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'razonando' }] },
        {
          type: 'message',
          id: 'resp-2_msg',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'la respuesta' }],
        },
      ],
      usage: { input_tokens: 9, output_tokens: 11, total_tokens: 20 },
    });

    expect(result).toEqual({
      id: 'resp-2',
      model: 'MiniMax-M3.1-Flash',
      content: 'la respuesta',
      reasoningContent: 'razonando',
      finishReason: 'stop',
      usage: { inputTokens: 9, outputTokens: 11, totalTokens: 20 },
    });
  });

  it('reports an incomplete Responses run as a length stop', () => {
    const result = fromResponsesPayload({ id: 'r', model: 'm', status: 'incomplete', output: [] });

    expect(result.finishReason).toBe('length');
  });
});
