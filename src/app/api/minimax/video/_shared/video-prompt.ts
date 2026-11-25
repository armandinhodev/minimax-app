/**
 * Extracts the prompt from a normalized content array so it can be stored
 * alongside the task in the Library.
 */
export function extractVideoPrompt(
  content: readonly { type: string; text?: string }[],
): string | undefined {
  return content.find((item) => item.type === 'text')?.text;
}
