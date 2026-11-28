import { describe, expect, it } from 'vitest';

import { nextConversation } from './conversation';

describe('nextConversation', () => {
  it('appends the previous assistant reply before the new user turn', () => {
    const messages = [
      { role: 'user' as const, text: 'Hello' },
      { role: 'assistant' as const, text: 'Hi, how can I help?' },
      { role: 'user' as const, text: 'Draft a prompt' },
    ];

    expect(nextConversation(messages, { content: 'A short prompt.' }, 'Make it shorter')).toEqual([
      ...messages,
      { role: 'assistant', text: 'A short prompt.' },
      { role: 'user', text: 'Make it shorter' },
    ]);
  });

  it('skips an empty reply so the upstream conversation stays valid', () => {
    expect(nextConversation([], { content: '   ' }, 'Hello')).toEqual([
      { role: 'user', text: 'Hello' },
    ]);
  });
});
