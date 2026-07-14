/** Максимум сообщений в игровом чате; при превышении удаляются самые старые (сверху). */
export const GAME_CHAT_MAX_MESSAGES = 100;

export function pruneChatByLimit<T>(
  messages: readonly T[],
  max = GAME_CHAT_MAX_MESSAGES,
): T[] {
  if (messages.length <= max) return [...messages];
  return messages.slice(-max);
}
