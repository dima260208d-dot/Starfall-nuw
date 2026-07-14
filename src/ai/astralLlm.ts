/**
 * ─── Опциональный LLM-режим для Астрала ─────────────────────────────────────
 *
 * Астрал по умолчанию работает на локальных правилах (rule-based) — это
 * быстро, оффлайн, без API ключей. Но если пользователь захочет «настоящий
 * ИИ», он может ввести свой API-ключ OpenAI или OpenRouter — и тогда чат
 * перенаправляется на полноценную LLM с системным промптом, в который
 * подмешан контекст игры.
 *
 * Архитектура:
 *   • Настройки хранятся в localStorage ("astral_llm_v1") — не утекают в
 *     профиль, потому что ключ конфиденциален.
 *   • Поддерживаются 2 провайдера: OpenAI direct и OpenRouter (тот же
 *     протокол /v1/chat/completions, удобнее для пользователя — он может
 *     выбрать любую модель из их каталога).
 *   • Системный промпт описывает Астрала и снабжает LLM фактами о текущем
 *     профиле игрока и доступном арсенале — модель не должна выдумывать.
 *   • Запрос — обычный fetch с timeout 12s, при ошибке возвращаем null и
 *     вызывающий fallback на rule-based ответ.
 */

import { getCurrentProfile } from "../utils/localStorageAPI";
import { getLocale, LOCALE_PROMPT_NAMES } from "../i18n";
import { isStarGuardianActive } from "../utils/subscription";
import { BRAWLERS } from "../entities/BrawlerData";
import { PETS } from "../entities/PetData";
import { buildFullAstralKnowledge } from "../data/astralKnowledge";
import { BRAWLER_RUSSIAN_NAMES } from "../utils/brawlerDisplay";

const GAME_NAME = "Starfall";

// ─── Тип настроек ─────────────────────────────────────────────────────────────

export type LlmProvider = "openai" | "openrouter";

export interface AstralLlmSettings {
  /** Включён ли LLM-режим (true → пробуем LLM, fallback на правила). */
  enabled: boolean;
  /** Какой провайдер. */
  provider: LlmProvider;
  /** API ключ — НЕ синхронизируется с профилем, только localStorage. */
  apiKey: string;
  /** Имя модели. Дефолт: gpt-4o-mini для openai, anthropic/claude-3-haiku для openrouter. */
  model: string;
  /** Температура (0..2). Дефолт 0.6 — Астрал должен быть точным, но живым. */
  temperature: number;
}

const STORAGE_KEY = "astral_llm_v1";

const DEFAULT_SETTINGS: AstralLlmSettings = {
  enabled: false,
  provider: "openrouter",
  apiKey: "",
  // openai/gpt-4o-mini — доступна на OpenRouter большинству ключей, дёшевая,
  // быстрая. Для OpenAI direct замени на "gpt-4o-mini" или "gpt-4.1-mini".
  model: "openai/gpt-4o-mini",
  temperature: 0.6,
};

/**
 * Нормализует ключ: trim, удаляет «Bearer » если пользователь скопировал
 * с префиксом, удаляет внутренние пробелы (часто остаются при копировании
 * через мобильную клавиатуру).
 */
function sanitizeKey(raw: string): string {
  if (!raw) return "";
  let k = raw.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, "");
  // Внутренние пробелы — частая ошибка при копипасте. Сами ключи их не содержат.
  k = k.replace(/\s+/g, "");
  return k;
}

export function getAstralLlmSettings(): AstralLlmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateAstralLlmSettings(patch: Partial<AstralLlmSettings>): AstralLlmSettings {
  const cur = getAstralLlmSettings();
  const next = { ...cur, ...patch };
  // Любая запись ключа проходит через sanitize — даже если patch принес чистый
  // ключ, sanitize не сломает; если пришла строка с пробелами или "Bearer "
  // — отсечёт.
  if (typeof patch.apiKey === "string") next.apiKey = sanitizeKey(patch.apiKey);
  if (typeof patch.model === "string") next.model = patch.model.trim();
  if (patch.provider && patch.model === undefined) {
    next.model = defaultModelForProvider(patch.provider);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage недоступен — игнорируем */
  }
  return next;
}

/**
 * Авто-определение провайдера по префиксу ключа:
 *   • `sk-or-...` → OpenRouter (их формат)
 *   • `sk-...`    → OpenAI
 * Возвращает null если префикс не распознан (пользователь сам выберет).
 */
export function guessProviderFromKey(key: string): LlmProvider | null {
  const k = sanitizeKey(key);
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

/**
 * Удобный быстрый чек: «можно ли вообще пробовать LLM сейчас?»
 * — Настройки включены, ключ непустой и похож на настоящий API key.
 */
export function isLlmReady(): boolean {
  if (!isStarGuardianActive()) return false;
  const s = getAstralLlmSettings();
  return s.enabled && sanitizeKey(s.apiKey).length >= 20;
}

// ─── Системный промпт + контекст игры ────────────────────────────────────────

/**
 * Системный промпт Астрала. Подробный, на русском. Включает «memory» о
 * текущем профиле игрока (динамическая часть), чтобы LLM мог давать
 * персональные ответы.
 */
export function buildSystemPrompt(): string {
  const profile = getCurrentProfile();
  const locale = getLocale();
  const langName = LOCALE_PROMPT_NAMES[locale] ?? "Russian";
  const lines: string[] = [];

  lines.push(`You are Astral, the star AI companion in the mobile game «${GAME_NAME}».`);
  lines.push(`Always call the game only «${GAME_NAME}» (or localized equivalent). Do not invent other game titles.`);
  lines.push(`Reply STRICTLY in ${langName}, friendly and brief (≤ 4–5 sentences), with emoji when appropriate.`);
  lines.push("Use only facts from the knowledge base below; do not hallucinate.");
  lines.push("");
  if (locale === "ru") {
    lines.push("ОБЯЗАТЕЛЬНО: имена бойцов только по-русски — " + Object.values(BRAWLER_RUSSIAN_NAMES).join(", ") + ".");
    lines.push("Запрещено писать латинские имена (Ronin, Yuki, Miya, Kenji и т.д.) — отвечай с русским именем.");
  } else {
    lines.push("Use official in-game English mode names (Star Strike, Star Battle, etc.) where relevant.");
  }
  lines.push("");
  lines.push(buildFullAstralKnowledge());

  if (profile) {
    lines.push("");
    lines.push("===== ТЕКУЩИЙ ПРОФИЛЬ ИГРОКА =====");
    lines.push(`Имя: ${profile.username}, трофеи: ${profile.trophies}, побед: ${profile.totalWins}/${profile.totalGamesPlayed}`);
    lines.push(`Монеты: ${profile.coins}, кристаллы: ${profile.gems}, power-points: ${profile.powerPoints}`);
    lines.push(`Открыто бойцов: ${profile.unlockedBrawlers.length}/${BRAWLERS.length}`);
    if (profile.favoriteBrawlerId) {
      const fb = BRAWLERS.find(b => b.id === profile.favoriteBrawlerId);
      lines.push(`Любимый: ${fb?.name ?? profile.favoriteBrawlerId} (ур. ${profile.brawlerLevels[profile.favoriteBrawlerId] ?? 1})`);
    }
    const pet = profile.equippedPetId ? PETS.find(p => p.id === profile.equippedPetId) : null;
    if (pet) lines.push(`Питомец: ${pet.name}`);
    if (profile.clashPassLevel) lines.push(`Star Pass: уровень ${profile.clashPassLevel}${profile.clashPassPaid ? " (платный)" : ""}`);
  }

  lines.push("");
  lines.push("Если игрок просит действие (сундук, прокачка, питомец) — НЕ выполняй сам; ответь что команда обработается снаружи.");
  lines.push("Если факта нет в базе — честно скажи, не выдумывай.");
  return lines.join("\n");
}

/** Короткий промпт для теста подключения — меньше шанс 502 от перегруза. */
function buildMinimalSystemPrompt(): string {
  const langName = LOCALE_PROMPT_NAMES[getLocale()] ?? "Russian";
  return `You are Astral, AI helper for ${GAME_NAME}. Reply in ${langName}, very briefly.`;
}

/** Стабильные модели для OpenRouter / OpenAI. */
export const LLM_MODEL_PRESETS: Record<LlmProvider, { id: string; label: string }[]> = {
  openrouter: [
    { id: "openai/gpt-4o-mini", label: "GPT-4o mini (рекомендуется)" },
    { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (рекомендуется)" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
};

export function defaultModelForProvider(p: LlmProvider): string {
  return LLM_MODEL_PRESETS[p][0].id;
}

// ─── Сетевой запрос ──────────────────────────────────────────────────────────

interface LlmMessage { role: "system" | "user" | "assistant"; content: string; }

/**
 * Результат вызова LLM. `ok=true` — пришёл валидный ответ. `ok=false` —
 * можно показать пользователю конкретную причину (статус, текст ошибки от
 * провайдера, или сетевое исключение). Раньше возвращался просто `null` —
 * пользователь не понимал, почему «не работает».
 */
export type LlmResult =
  | { ok: true; text: string }
  | { ok: false; status?: number; error: string };

/**
 * В браузере OpenAI блокирует CORS — идём через прокси Vite (`/llm-proxy/...`).
 * OpenRouter тоже через прокси для единообразия и стабильности в dev/preview.
 */
function endpointForProvider(p: LlmProvider): string {
  if (typeof window !== "undefined") {
    return p === "openai"
      ? "/llm-proxy/openai/v1/chat/completions"
      : "/llm-proxy/openrouter/api/v1/chat/completions";
  }
  return p === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
}

/** Проверка: ключ подходит выбранному провайдеру. */
export function validateProviderKeyMatch(
  provider: LlmProvider,
  apiKey: string,
): string | null {
  const k = sanitizeKey(apiKey);
  if (!k) return null;
  if (k.startsWith("sk-or-") && provider !== "openrouter") {
    return "Ключ OpenRouter (sk-or-…) — выбери провайдер OpenRouter.";
  }
  if (k.startsWith("sk-or-")) return null;
  if ((k.startsWith("sk-proj-") || k.startsWith("sk-")) && provider === "openrouter") {
    return "Похоже на ключ OpenAI — выбери провайдер OpenAI или получи ключ на openrouter.ai.";
  }
  return null;
}

/** Чеклист перед тестом — помогает понять, ошибка у игрока или в настройках. */
export function diagnoseLlmSetup(): string[] {
  const issues: string[] = [];
  if (!isStarGuardianActive()) {
    issues.push("Нет активной подписки Star Guardian.");
  }
  const s = getAstralLlmSettings();
  if (!s.enabled) {
    issues.push(
      "Не включён переключатель «Своя нейросеть» — открой чат Астрала (✨) → кнопка «⚙️ ИИ» справа вверху → включи переключатель вверху панели.",
    );
  }
  const key = sanitizeKey(s.apiKey);
  if (key.length < 20) issues.push("API-ключ слишком короткий или пустой.");
  const mismatch = validateProviderKeyMatch(s.provider, key);
  if (mismatch) issues.push(mismatch);
  if (!s.model.trim()) issues.push("Не указано имя модели.");
  if (s.provider === "openai" && s.model.includes("/")) {
    issues.push("Для OpenAI укажи модель без префикса: gpt-4o-mini (не openai/gpt-4o-mini).");
  }
  if (s.provider === "openrouter" && !s.model.includes("/")) {
    issues.push("Для OpenRouter модель с префиксом: openai/gpt-4o-mini");
  }
  if (typeof window !== "undefined" && !import.meta.env.DEV) {
    issues.push(
      "Совет: запускай игру через npm run dev или npm run serve — иначе прокси LLM может не работать.",
    );
  }
  return issues;
}

function buildHeaders(s: AstralLlmSettings): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // sanitize нужен на случай если в storage по какой-то причине лежит
    // «грязный» ключ (импорт из старой версии и т.п.).
    "Authorization": `Bearer ${sanitizeKey(s.apiKey)}`,
  };
  if (s.provider === "openrouter") {
    // OpenRouter рекомендует HTTP-Referer и X-Title для аналитики. В
    // браузере это разрешённые кастомные заголовки (а сам Referer —
    // forbidden header в fetch, поэтому используем именно HTTP-Referer).
    headers["HTTP-Referer"] = typeof window !== "undefined"
      ? window.location.origin
      : "https://star-brawlers.app";
    headers["X-Title"] = "Starfall Astral";
  }
  return headers;
}

function extractAssistantText(data: unknown): string {
  const choice = (data as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> })?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();
  }
  if (typeof choice?.text === "string") return choice.text.trim();
  return "";
}

function looksLikeMissingProxyResponse(status: number, body: string, contentType: string): boolean {
  if (status !== 404 && status !== 405 && status !== 501) return false;
  const text = body.slice(0, 300).toLowerCase();
  return contentType.includes("text/html")
    || text.includes("<!doctype")
    || text.includes("<html")
    || text.includes("cannot post")
    || text.includes("not found");
}

function proxyHint(provider: LlmProvider): string {
  return provider === "openai"
    ? "LLM-прокси не найден. Запусти игру через npm run dev или npm run serve, иначе OpenAI из браузера обычно блокируется CORS."
    : "LLM-прокси не найден. Запусти игру через npm run dev или npm run serve. Если используешь статический dist, запросы к /llm-proxy некуда отправлять.";
}

/**
 * Универсальный вызов /v1/chat/completions. Возвращает структурированный
 * результат с диагностикой (статус, текст ошибки от провайдера). Вызывающий
 * получает либо успешный текст, либо описательную ошибку — никаких глухих
 * `null`.
 */
export interface CallLlmOptions {
  maxTokens?: number;
  temperature?: number;
  /** Лёгкий системный промпт (для теста ключа). */
  minimal?: boolean;
  /** Дополнительный контекст (чат клуба, команда и т.д.). */
  systemPromptExtra?: string;
  /** Временно другая модель (автоподбор при 502). */
  modelOverride?: string;
  /** Для кнопки теста: HTTP 200 уже доказывает, что ключ/прокси живые. */
  acceptEmptyOk?: boolean;
}

export async function callLlm(
  userMessage: string,
  history?: LlmMessage[],
  options?: CallLlmOptions,
): Promise<LlmResult> {
  if (!isStarGuardianActive()) {
    return { ok: false, error: "Своя модель ИИ доступна только с подпиской Star Guardian." };
  }
  const s = getAstralLlmSettings();
  if (!s.enabled) {
    return {
      ok: false,
      error:
        "Своя нейросеть выключена. В чате Астрала нажми «⚙️ ИИ» (справа вверху) и включи переключатель «Своя нейросеть (LLM)».",
    };
  }
  if (!sanitizeKey(s.apiKey)) return { ok: false, error: "API-ключ не задан или пустой." };

  const keyMismatch = validateProviderKeyMatch(s.provider, s.apiKey);
  if (keyMismatch) return { ok: false, error: keyMismatch };

  const url = endpointForProvider(s.provider);

  const model = (options?.modelOverride ?? s.model).trim();
  const systemContent = options?.minimal
    ? buildMinimalSystemPrompt()
    : buildSystemPrompt() + (options?.systemPromptExtra ? `\n\n${options.systemPromptExtra}` : "");
  const messages: LlmMessage[] = [
    { role: "system", content: systemContent },
    ...(history ?? []).slice(-6),
    { role: "user", content: userMessage },
  ];

  const body = JSON.stringify({
    model,
    messages,
    temperature: options?.temperature ?? s.temperature,
    max_tokens: options?.maxTokens ?? 600,
  });

  // Timeout через AbortController — без него fetch может висеть бесконечно.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(s),
      body,
      signal: ac.signal,
    });
    const contentType = res.headers.get("content-type") ?? "";
    const rawText = await res.text().catch(() => "");

    if (looksLikeMissingProxyResponse(res.status, rawText, contentType) && url.startsWith("/llm-proxy")) {
      return { ok: false, status: res.status, error: proxyHint(s.provider) };
    }

    if (!res.ok) {
      const errText = rawText;
      // Пробуем распарсить JSON-ошибку провайдера для красивого сообщения.
      let pretty = errText;
      try {
        const j = JSON.parse(errText);
        pretty = j?.error?.message || j?.message || errText;
      } catch { /* not json — ok */ }
      const friendly = res.status === 401
        ? `401 Unauthorized — неверный API-ключ или ключ не подходит для провайдера ${s.provider}.`
        : res.status === 402
          ? "402 Payment Required — на аккаунте кончились средства/кредиты."
          : res.status === 404
            ? `404 — модель «${s.model}» не найдена у провайдера ${s.provider}. Попробуй openai/gpt-4o-mini.`
            : res.status === 429
              ? "429 Rate Limit — слишком много запросов, подожди немного."
              : res.status === 502
                ? `502 — модель «${model}» сейчас не отвечает у ${s.provider === "openrouter" ? "OpenRouter" : "OpenAI"} (${pretty || "Provider returned error"}). Поставь модель: ${defaultModelForProvider(s.provider)}`
                : `${res.status}: ${pretty || "сервер вернул ошибку"}`;
      console.warn("[Astral LLM]", friendly, errText);
      return { ok: false, status: res.status, error: friendly };
    }

    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        error: url.startsWith("/llm-proxy")
          ? `${proxyHint(s.provider)} Сервер вернул не JSON, а ${contentType || "неизвестный тип ответа"}.`
          : `Провайдер вернул не JSON, а ${contentType || "неизвестный тип ответа"}.`,
      };
    }

    const data = JSON.parse(rawText);
    const text = extractAssistantText(data);
    if (!text) {
      if (options?.acceptEmptyOk) {
        return {
          ok: true,
          text: "сервер ответил, но тестовая модель вернула пустой текст; подключение живое",
        };
      }
      return { ok: false, error: "Сервер вернул пустой ответ (возможно, фильтр контента)." };
    }
    return { ok: true, text };
  } catch (err: unknown) {
    const aborted = (err as { name?: string })?.name === "AbortError";
    const is404proxy = err instanceof TypeError && url.startsWith("/llm-proxy");
    const msg = aborted
      ? "Таймаут 15 сек — сервер не ответил. Проверь интернет/VPN."
      : is404proxy
        ? "Не удалось достучаться до LLM-прокси. Запусти игру командой npm run dev (не открывай index.html напрямую)."
        : err instanceof Error
          ? `Сетевая ошибка: ${err.message}. Часто это CORS — перезапусти через npm run dev.`
          : "Сетевая ошибка (неизвестная).";
    console.warn("[Astral LLM] fetch failed:", err);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Минимальный тестовый запрос для кнопки «Проверить подключение». Спрашивает
 * "ping" и проверяет что пришёл хоть какой-то ответ. Хороший индикатор для
 * пользователя, что ключ + модель + сеть в порядке.
 */
export async function testLlmConnection(): Promise<LlmResult> {
  const pre = diagnoseLlmSetup().filter(
    x => !x.startsWith("Совет:"),
  );
  if (pre.length > 0) {
    return { ok: false, error: `Проверь настройки:\n• ${pre.join("\n• ")}` };
  }

  const s = getAstralLlmSettings();
  const fallback = defaultModelForProvider(s.provider);
  const testOpts = { minimal: true, maxTokens: 96, temperature: 0.2, acceptEmptyOk: true } as const;

  const first = await callLlm("Напиши коротко: подключение работает.", [], testOpts);
  if (first.ok) return first;

  const retryable = (first.status === 502 || first.status === 404) && !first.error.toLowerCase().includes("прокси");
  if (retryable && s.model.trim() !== fallback) {
    const second = await callLlm("Напиши коротко: подключение работает.", [], {
      ...testOpts,
      modelOverride: fallback,
    });
    if (second.ok) {
      updateAstralLlmSettings({ model: fallback });
      return {
        ok: true,
        text: `${second.text}\n\n✓ Модель «${s.model}» недоступна — переключил на «${fallback}».`,
      };
    }
    return {
      ok: false,
      status: second.status ?? first.status,
      error: `${second.error}\n\nТвоя модель «${s.model}» тоже не сработала. Выбери из списка в настройках, например «${fallback}».`,
    };
  }

  return first;
}

// ─── История диалога (для контекста) ─────────────────────────────────────────

const HISTORY_KEY = "astral_llm_history_v1";
const HISTORY_MAX = 10;

export function getChatHistory(): LlmMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-HISTORY_MAX);
  } catch { return []; }
}

export function appendChatHistory(userMsg: string, astralReply: string): void {
  const cur = getChatHistory();
  cur.push({ role: "user", content: userMsg });
  cur.push({ role: "assistant", content: astralReply });
  const trimmed = cur.slice(-HISTORY_MAX);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
}

export function clearChatHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}
