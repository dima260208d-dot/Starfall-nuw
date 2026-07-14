/**
 * Астрал отвечает в клубном и командном чате, если игрок с подпиской упомянул его по имени.
 */
import { astralChatReply } from "./astralBrain";
import { isStarGuardianActive } from "../utils/subscription";
import { buildAstralGameChatContext } from "./astralChatContext";

export const ASTRAL_CHAT_USERNAME = "✨ Астрал";
export const ASTRAL_CHAT_PLAYER_ID = "__astral__";

const MENTION_PATTERN = /astral|астрал/i;

export type AstralChatChannel = "club" | "party";

export interface AstralChatContext {
  channel: AstralChatChannel;
  senderUsername: string;
  /** Для чата клуба — id клуба, чтобы подтянуть сокровищницу и фонд. */
  clubId?: string;
}

export function messageMentionsAstral(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return MENTION_PATTERN.test(trimmed);
}

function buildAstralPrompt(userMessage: string, ctx: AstralChatContext): string {
  const place = ctx.channel === "club" ? "чате клуба" : "чате команды";
  return [
    `Игрок ${ctx.senderUsername} обратился к тебе (Астрал) в ${place}.`,
    `Сообщение: «${userMessage}»`,
    "Ответь кратко (1–3 предложения), по-русски, от первого лица, полезно и дружелюбно.",
    "Используй только факты из блока «КОНТЕКСТ ЧАТА» в системном промпте.",
    "Не упоминай подписку и технические детали, если об этом не спрашивали.",
  ].join("\n");
}

let pendingReplies = 0;
const MAX_PENDING = 2;

/** Асинхронно генерирует ответ Астрала и вызывает onReply (если есть подписка и упоминание). */
export function scheduleAstralChatReply(
  userMessage: string,
  ctx: AstralChatContext,
  onReply: (text: string) => void,
): void {
  if (!isStarGuardianActive()) return;
  if (!messageMentionsAstral(userMessage)) return;
  if (pendingReplies >= MAX_PENDING) return;

  pendingReplies += 1;
  void (async () => {
    try {
      const gameContext = buildAstralGameChatContext(ctx.channel, ctx.senderUsername, ctx.clubId);
      const prompt = buildAstralPrompt(userMessage, ctx);
      const reply = await astralChatReply(userMessage, gameContext, prompt);
      const text = (reply.text ?? "").trim();
      if (text) onReply(text);
    } catch {
      /* ignore — чат не должен ломаться из-за Астрала */
    } finally {
      pendingReplies -= 1;
    }
  })();
}
