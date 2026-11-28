/**
 * Build the conversation sent upstream, including the previous assistant turn.
 *
 * The UI keeps the reply being streamed in a separate state so it can render
 * incrementally. When the next message is sent, that reply becomes history.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function nextConversation(
  messages: ChatMessage[],
  reply: { content: string } | null,
  prompt: string,
): ChatMessage[] {
  const withReply = reply?.content.trim()
    ? [...messages, { role: "assistant" as const, text: reply.content }]
    : messages;

  return [...withReply, { role: "user", text: prompt }];
}
