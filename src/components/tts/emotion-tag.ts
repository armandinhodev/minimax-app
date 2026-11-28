/**
 * Insert an interjection tag after the selection (or at the caret).
 *
 * MiniMax reads the tag after the word it colors, so the words are never
 * replaced: `people(sighs),` is the documented shape.
 */
export function insertEmotionTag(
  text: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  tag: string,
): { text: string; caret: number } {
  const token = `(${tag})`;
  const start = selectionStart ?? text.length;
  const end = selectionEnd ?? start;
  const position = Math.min(Math.max(end, 0), text.length);

  return {
    text: text.slice(0, position) + token + text.slice(position),
    caret: position + token.length,
  };
}
