import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { executeCommand, looksLikeCommand } from "../ai/AstralAssistant";
import { astralReply } from "../ai/astralBrain";
import { guardianModerateForSend } from "../ai/contentGuardianAi";
import { isStarGuardianActive } from "../utils/subscription";
import { pruneChatByLimit } from "../utils/chatLimits";
import {
  appendChatHistory,
  diagnoseLlmSetup,
  getAstralLlmSettings,
  guessProviderFromKey,
  isLlmReady,
  LLM_MODEL_PRESETS,
  testLlmConnection,
  updateAstralLlmSettings,
  validateProviderKeyMatch,
} from "../ai/astralLlm";
import AstralLlmSetupGuide, { type LlmGuideProvider } from "./AstralLlmSetupGuide";
import AstralOrbAvatar from "./AstralOrbAvatar";
import { useI18n, translate } from "../i18n";
import { EmojiIcon, TextWithEmojis } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Msg { who: "user" | "astral"; text: string; time: number; pending?: boolean }

interface Props { onClose: () => void; initialMessage?: string }

export default function AstralChatModal({ onClose, initialMessage }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(isStarGuardianActive());
  const [llmOn, setLlmOn] = useState(isLlmReady());
  const [showLlmPanel, setShowLlmPanel] = useState(false);
  const [highlightLlmToggle, setHighlightLlmToggle] = useState(false);
  const [llmGuide, setLlmGuide] = useState<LlmGuideProvider | null>(null);
  const [llmSettings, setLlmSettings] = useState(getAstralLlmSettings());
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      who: "astral",
      time: Date.now(),
      text: isStarGuardianActive()
        ? translate("astral.welcomeActive")
        : translate("astral.welcomeFree"),
    },
  ]);
  const [input, setInput] = useState(initialMessage ?? "");
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 900,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  }));
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendMessages = useCallback((prev: Msg[], ...items: Msg[]): Msg[] => {
    if (items.length === 0) return prev;
    return pruneChatByLimit([...prev, ...items]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const t = setInterval(() => {
      setActive(isStarGuardianActive());
      setLlmOn(isLlmReady());
    }, 1500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Отправка сообщения. Логика:
   *   1. Если это команда (открой/прокачай/...) — обрабатываем мгновенно через
   *      executeCommand. LLM сюда не подключаем — команды должны быть
   *      детерминированными.
   *   2. Если LLM-режим включён и ключ задан — добавляем плейсхолдер «думаю…»
   *      и асинхронно запрашиваем LLM. При успехе подменяем плейсхолдер
   *      ответом LLM, иначе — fallback на rule-based.
   *   3. Иначе — rule-based ответ сразу.
   */
  const send = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;

    const mod = await guardianModerateForSend(value, "astral_chat");
    if (!mod.allowed) {
      setInput("");
      setMessages(prev => appendMessages(prev, { who: "astral", text: mod.userMessage, time: Date.now() }));
      return;
    }

    setInput("");
    const userMsg: Msg = { who: "user", text: value, time: Date.now() };

    // ── Команды (только для Star Guardian, обработка мгновенная) ───────────
    if (looksLikeCommand(value)) {
      let reply = "";
      try {
        const r = executeCommand(value);
        if (r.handled) {
          reply = r.reply;
        } else {
          reply = (await astralReply(value)).text;
        }
      } catch {
        reply = t("astral.commandConfused");
      }
      setMessages(prev => appendMessages(prev, userMsg, { who: "astral", text: reply, time: Date.now() + 1 }));
      return;
    }

    if (isLlmReady()) {
      const pendingId = Date.now() + 1;
      setMessages(prev => appendMessages(
        prev,
        userMsg,
        { who: "astral", text: t("astral.thinking"), time: pendingId, pending: true },
      ));
      const reply = (await astralReply(value)).text;
      appendChatHistory(value, reply);
      setMessages(prev =>
        pruneChatByLimit(prev.map(m => (m.time === pendingId ? { ...m, text: reply, pending: false } : m))),
      );
      return;
    }

    const reply = (await astralReply(value)).text;
    setMessages(prev => appendMessages(prev, userMsg, { who: "astral", text: reply, time: Date.now() + 1 }));
  };

  // ── Сохранение настроек LLM ─────────────────────────────────────────────
  const saveLlmSettings = (patch: Partial<typeof llmSettings>) => {
    if (!isStarGuardianActive()) {
      setMessages(prev => appendMessages(prev, {
        who: "astral",
        text: t("astral.llmLocked"),
        time: Date.now(),
      }));
      return;
    }
    // Если меняется ключ — пробуем угадать провайдер по префиксу. Удобно,
    // когда пользователь вставляет «sk-or-…» — мы сразу переключим режим
    // на openrouter, и наоборот.
    let merged = { ...patch };
    if (typeof patch.apiKey === "string" && patch.apiKey.length > 10) {
      const guess = guessProviderFromKey(patch.apiKey);
      if (guess && guess !== llmSettings.provider) {
        merged.provider = guess;
      }
    }
    const next = updateAstralLlmSettings(merged);
    setLlmSettings(next);
    setLlmOn(isLlmReady());
    const mismatch = validateProviderKeyMatch(next.provider, next.apiKey);
    if (mismatch) {
      setMessages(prev => appendMessages(prev, { who: "astral", text: `\u26a0\ufe0f ${mismatch}`, time: Date.now() }));
    }
  };

  // ── Тестирование подключения ────────────────────────────────────────────
  const [testing, setTesting] = useState(false);
  const runConnectionTest = async () => {
    if (active && !llmSettings.enabled && llmSettings.apiKey.trim().length >= 20) {
      saveLlmSettings({ enabled: true });
    }
    setShowLlmPanel(true);
    setTesting(true);
    try {
      const res = await testLlmConnection();
      const freshSettings = getAstralLlmSettings();
      setLlmSettings(freshSettings);
      setLlmOn(isLlmReady());
      const ok = res.ok;
      const hints = diagnoseLlmSetup();
      const needsToggle = !ok && !freshSettings.enabled && freshSettings.apiKey.trim().length >= 20;
      if (needsToggle) {
        setHighlightLlmToggle(true);
        setTimeout(() => setHighlightLlmToggle(false), 5000);
      }
      const text = ok
        ? t("astral.connectionOk", { text: res.text.slice(0, 120) })
        : "\u274c " + res.error + (hints.length ? "\n\n\uD83D\uDCA1 " + hints.join("\n\uD83D\uDCA1 ") : "");
      setMessages(prev => appendMessages(prev, { who: "astral", text, time: Date.now() }));
      if (ok) setShowLlmPanel(false);
    } finally {
      setTesting(false);
    }
  };

  const suggestions = active
    ? [t("astral.suggestActive1"), t("astral.suggestActive2"), t("astral.suggestActive3"), t("astral.suggestActive4")]
    : [t("astral.suggestFree1"), t("astral.suggestFree2"), t("astral.suggestFree3"), t("astral.suggestFree4")];
  const compact = viewport.h < 660;
  const narrow = viewport.w < 560;
  const safePad = compact ? 6 : 12;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "rgba(2,0,18,0.08)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: safePad,
          bottom: safePad,
          left: "50%",
          transform: "translateX(-50%)",
          width: narrow ? `calc(100vw - ${safePad * 2}px)` : "min(590px, calc(100vw - 24px))",
          minHeight: 0,
          background:
            "linear-gradient(180deg, rgba(255,232,250,0.20) 0%, rgba(222,198,255,0.14) 48%, rgba(255,205,238,0.16) 100%)",
          border: "1px solid rgba(244,180,255,0.48)",
          borderRadius: compact ? 16 : 20,
          boxShadow:
            "0 18px 58px rgba(0,0,0,0.34), 0 0 34px rgba(244,143,255,0.20), inset 0 1px 0 rgba(255,255,255,0.28)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", color: "var(--t-1)",
          fontFamily: "var(--app-font-sans)",
          backdropFilter: "blur(10px) saturate(1.22)",
          WebkitBackdropFilter: "blur(10px) saturate(1.22)",
        }}
      >
        <div style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          borderRadius: compact ? 16 : 20,
          background:
            "radial-gradient(circle at 18% -8%, rgba(255,180,245,0.24), transparent 28%), radial-gradient(circle at 86% 106%, rgba(179,136,255,0.18), transparent 32%)",
          opacity: 1,
        }} />
        <div style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          borderRadius: compact ? 16 : 20,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
          zIndex: 2,
        }} />
        {/* Header */}
        <div style={{
          padding: compact ? "7px 10px" : "10px 14px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06)), linear-gradient(90deg, rgba(255,128,220,0.16), rgba(179,136,255,0.14), rgba(255,213,245,0.10))",
          borderBottom: "1px solid rgba(244,180,255,0.26)",
          display: "flex", alignItems: "center", gap: compact ? 8 : 12,
          boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.12)",
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
        }}>
          <div style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(255,128,220,0.85), rgba(179,136,255,0.85), transparent)",
          }} />
          <AstralOrbAvatar size={compact ? 34 : 44} llmActive={llmOn} starGuardian={active} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{
                fontWeight: 950,
                fontSize: compact ? 14 : 17,
                letterSpacing: "0.12em",
                color: "#F7FBFF",
                textShadow: "0 0 16px rgba(244,143,255,0.38)",
              }}>
                <Tr id="astral.name" />
              </span>
              {llmOn && (
                <span style={{
                  flexShrink: 0,
                  fontSize: compact ? 8 : 9,
                  color: "#06151a",
                  background: "linear-gradient(135deg, #69F0AE, #40C4FF)",
                  borderRadius: 999,
                  padding: "2px 7px",
                  fontWeight: 950,
                  letterSpacing: "0.08em",
                }}>
                  NEURAL
                </span>
              )}
            </div>
            <div style={{
              fontSize: compact ? 9 : 11,
              color: active ? "#F8D7FF" : "rgba(255,255,255,0.68)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {active ? "STAR GUARDIAN · ONLINE" : "FREE MODE"}
              {llmOn ? ` · ${llmSettings.provider} / ${llmSettings.model.split("/").pop()}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="no-ui-shear"
            onClick={() => {
              if (!active) {
                setMessages(prev => appendMessages(prev, {
                  who: "astral",
                  text: t("astral.llmLockedShort"),
                  time: Date.now(),
                }));
                setShowLlmPanel(false);
                return;
              }
              setShowLlmPanel(v => !v);
            }}
            title={active ? t("astral.settingsTitle") : t("astral.settingsLockedTitle")}
            style={{
              marginRight: compact ? 2 : 6,
              padding: compact ? "5px 10px" : "6px 12px",
              borderRadius: 10,
              border: showLlmPanel ? "1px solid rgba(244,180,255,0.72)" : "1px solid rgba(244,180,255,0.42)",
              background: llmOn
                ? "linear-gradient(135deg, rgba(123,47,190,0.55), rgba(179,136,255,0.35))"
                : "rgba(255,255,255,0.10)",
              color: "#ffffff",
              fontSize: compact ? 10 : 11,
              fontWeight: 900,
              letterSpacing: 0.8,
              cursor: "pointer",
              opacity: active ? 1 : 0.65,
              boxShadow: showLlmPanel ? "0 0 16px rgba(244,143,255,0.30)" : undefined,
              textShadow: "0 1px 2px rgba(0,0,0,0.55)",
            }}
          >
            <Tr id="astral.aiBtn" />
          </button>
          <button
            onClick={onClose}
            className="ui-back-btn"
            style={{
              padding: compact ? "3px 8px" : "4px 10px", fontWeight: 800,
            }}
          ><EmojiIcon emoji="✕" size={20} /></button>
        </div>

        {/* LLM settings panel — Star Guardian only */}
        {showLlmPanel && (
          <div style={{
            padding: compact ? "8px 10px" : "10px 14px",
            background:
              "linear-gradient(180deg, rgba(255,232,250,0.16), rgba(222,198,255,0.10)), rgba(30,10,48,0.16)",
            borderBottom: "1px solid rgba(244,180,255,0.22)",
            display: "flex", flexDirection: "column", gap: 8,
            fontSize: compact ? 11 : 12,
            position: "relative",
            zIndex: 1,
            flexShrink: 0,
            maxHeight: compact ? "30vh" : "min(38vh, 292px)",
            overflowY: "auto",
            scrollbarWidth: "thin",
          }}>
            {!active ? (
              <>
                <div style={{ color: "#FFD740", lineHeight: 1.45 }}>
                  <Tr id="astral.llmLockedShort" />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    type="button"
                    className="no-ui-shear"
                    onClick={() => setLlmGuide("openrouter")}
                    style={astralPanelBtn}
                  >
                    <Tr id="sg.guideOpenRouter" />
                  </button>
                  <button
                    type="button"
                    className="no-ui-shear"
                    onClick={() => setLlmGuide("openai")}
                    style={astralPanelBtn}
                  >
                    <Tr id="sg.guideOpenAI" />
                  </button>
                </div>
              </>
            ) : (
            <>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 10,
              color: "#FFF2FC",
              fontWeight: 950,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              <span><Tr id="astral.coreTitle" /></span>
              <span style={{ color: llmSettings.enabled ? "#FFD6F7" : "#FFE57F" }}>
                {llmSettings.enabled ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: compact ? "8px 10px" : "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                background: llmSettings.enabled
                  ? "linear-gradient(135deg, rgba(255,180,245,0.18), rgba(179,136,255,0.12))"
                  : highlightLlmToggle
                    ? "linear-gradient(135deg, rgba(255,213,79,0.25), rgba(255,82,82,0.12))"
                    : "rgba(255,255,255,0.08)",
                border: highlightLlmToggle
                  ? "2px solid #FFD740"
                  : llmSettings.enabled
                    ? "1px solid rgba(255,180,245,0.55)"
                    : "1px solid rgba(244,180,255,0.32)",
                boxShadow: highlightLlmToggle ? "0 0 20px rgba(255,215,64,0.45)" : undefined,
              }}
            >
              <input
                type="checkbox"
                checked={llmSettings.enabled}
                onChange={e => {
                  setHighlightLlmToggle(false);
                  saveLlmSettings({ enabled: e.target.checked });
                }}
                style={{ width: 18, height: 18, cursor: "pointer", flexShrink: 0 }}
              />
              <span>
                <span style={{ display: "block", fontWeight: 900, fontSize: compact ? 12 : 13, color: "#FFF2FC" }}>
                  <Tr id="astral.customLlm" />
                </span>
                <span style={{ display: "block", fontSize: 10, color: "rgba(255,235,250,0.76)", marginTop: 4, lineHeight: 1.4 }}>
                  <Tr id="astral.customLlmHint" />
                </span>
              </span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" className="no-ui-shear" onClick={() => setLlmGuide("openrouter")} style={astralPanelBtn}>
                OpenRouter
              </button>
              <button type="button" className="no-ui-shear" onClick={() => setLlmGuide("openai")} style={astralPanelBtn}>
                OpenAI
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ minWidth: 70 }}><Tr id="astral.providerLabel" /></span>
              <select
                value={llmSettings.provider}
                onChange={e => saveLlmSettings({ provider: e.target.value as "openai" | "openrouter" })}
                style={{
                  flex: 1, background: "rgba(245,250,255,0.14)", color: "white",
                  border: "1px solid rgba(244,180,255,0.32)", borderRadius: 8,
                  padding: compact ? "4px 6px" : "6px 8px",
                }}
              >
                <option value="openrouter"><Tr id="astral.providerOpenRouterRecommended" /></option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(255,235,250,0.82)" }}><Tr id="astral.modelLabel" /></span>
              <select
                value={LLM_MODEL_PRESETS[llmSettings.provider].some(m => m.id === llmSettings.model)
                  ? llmSettings.model
                  : "__custom__"}
                onChange={e => {
                  if (e.target.value !== "__custom__") saveLlmSettings({ model: e.target.value });
                }}
                style={{
                  width: "100%", background: "rgba(245,250,255,0.14)", color: "white",
                  border: "1px solid rgba(244,180,255,0.32)", borderRadius: 8,
                  padding: compact ? "5px 7px" : "6px 8px", fontSize: compact ? 11 : 12,
                }}
              >
                {LLM_MODEL_PRESETS[llmSettings.provider].map(m => (
                  <option key={m.id} value={m.id} style={{ background: "#0a0040" }}>{m.label}</option>
                ))}
                <option value="__custom__" style={{ background: "#0a0040" }}><Tr id="astral.customModelOption" /></option>
              </select>
              <input
                value={llmSettings.model}
                onChange={e => saveLlmSettings({ model: e.target.value })}
                placeholder={llmSettings.provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini"}
                style={{
                  width: "100%", background: "rgba(245,250,255,0.14)", color: "white",
                  border: "1px solid rgba(244,180,255,0.32)", borderRadius: 8,
                  padding: compact ? "4px 6px" : "5px 7px", fontFamily: "monospace", fontSize: compact ? 10 : 11,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ minWidth: 70 }}><Tr id="astral.apiKeyLabel" /></span>
              <input
                type="password"
                value={llmSettings.apiKey}
                onChange={e => saveLlmSettings({ apiKey: e.target.value })}
                placeholder={t("astral.apiKeyPlaceholder")}
                style={{
                  flex: 1, minWidth: 0, background: "rgba(245,250,255,0.14)", color: "white",
                  border: "1px solid rgba(244,180,255,0.32)", borderRadius: 8,
                  padding: compact ? "4px 6px" : "5px 7px",
                  fontFamily: "monospace", fontSize: 11,
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,235,250,0.74)", lineHeight: 1.35 }}>
              <Tr id="astral.keyStorageHint" />{" "}
              <Tr id="astral.keyGetHint" />{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: "#FFE57F" }}>openrouter.ai/keys</a>
              {" "}<Tr id="clubs.or" />{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "#FFE57F" }}>platform.openai.com</a>
              <br />
              <Tr id="astral.modelFormatHint" />{" "}
              <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 3, margin: "0 3px" }}>provider/model</code>
              <Tr id="astral.modelFormatExample" />{" "}
              <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 3 }}>openai/gpt-4o-mini</code>.
              <Tr id="astral.modelFormatOpenAI" />{" "}
              <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 3, marginLeft: 3 }}>gpt-4o-mini</code>.
            </div>
            <button
              type="button"
              className="no-ui-shear"
              onClick={runConnectionTest}
              disabled={testing || !llmSettings.apiKey}
              style={{
                background: testing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #FFD54F, #69F0AE)",
                border: "none", borderRadius: 10, padding: compact ? "7px 10px" : "8px 12px",
                color: "#ffffff", cursor: testing || !llmSettings.apiKey ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 800, marginTop: 4,
                opacity: !llmSettings.apiKey ? 0.5 : 1,
                textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
              }}
            >
              {testing ? t("astral.testing") : t("astral.testConnection")}
            </button>
            </>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: compact ? "9px 10px" : "12px 14px",
          display: "flex", flexDirection: "column", gap: compact ? 8 : 10,
          minHeight: 0,
          position: "relative",
          zIndex: 1,
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.who === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              background: m.who === "user"
                ? "linear-gradient(135deg, rgba(244,143,255,0.34), rgba(179,136,255,0.22))"
                : "linear-gradient(160deg, rgba(255,232,250,0.18), rgba(222,198,255,0.10))",
              border: m.who === "user"
                ? "1px solid rgba(244,180,255,0.38)"
                : "1px solid rgba(244,180,255,0.28)",
              borderRadius: m.who === "user" ? "var(--r-md) var(--r-md) 4px var(--r-md)" : "var(--r-md) var(--r-md) var(--r-md) 4px",
              padding: compact ? "8px 10px" : "10px 14px",
              fontSize: compact ? 12.5 : 13.5, lineHeight: 1.45,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              opacity: m.pending ? 0.65 : 1,
              fontStyle: m.pending ? "italic" : "normal",
              boxShadow: m.who === "user"
                ? "0 8px 22px rgba(0,0,0,0.16), 0 0 18px rgba(244,143,255,0.14)"
                : "0 8px 22px rgba(0,0,0,0.14), 0 0 18px rgba(179,136,255,0.12)",
              backdropFilter: "blur(6px)",
              color: "var(--t-1)",
            }}>
              <TextWithEmojis text={m.text} emojiSize={24} />
            </div>
          ))}
        </div>

        {/* Suggestion chips */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          padding: compact ? "0 10px 6px" : "0 16px 8px",
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
        }}>
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              className="no-ui-shear"
              onClick={() => send(s)}
              style={{
                fontSize: compact ? 10 : 11,
                cursor: "pointer",
                padding: compact ? "6px 11px" : "7px 13px",
                borderRadius: 999,
                background: "rgba(30,10,48,0.42)",
                border: "1px solid rgba(244,180,255,0.48)",
                color: "#ffffff",
                fontWeight: 800,
                boxShadow: "0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
                textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(123,47,190,0.55)";
                e.currentTarget.style.borderColor = "rgba(244,180,255,0.72)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(30,10,48,0.42)";
                e.currentTarget.style.borderColor = "rgba(244,180,255,0.48)";
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{
          display: "flex", gap: compact ? 6 : 8, padding: compact ? 8 : 12,
          borderTop: "1px solid rgba(244,180,255,0.22)",
          background: "linear-gradient(90deg, rgba(255,232,250,0.11), rgba(222,198,255,0.09), rgba(255,232,250,0.11))",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={t("astral.inputPlaceholder")}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: compact ? 12.5 : 13.5,
              height: compact ? 38 : 42,
              borderRadius: 12,
              border: "1px solid rgba(244,180,255,0.32)",
              background: "rgba(255,232,250,0.14)",
              padding: "0 12px",
              outline: "none",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
            }}
          />
          <button
            type="button"
            className="no-ui-shear"
            onClick={() => send()}
            style={{
              flexShrink: 0,
              padding: compact ? "0 14px" : "0 20px",
              fontSize: compact ? 12 : 13,
              height: compact ? 38 : 42,
              borderRadius: 12,
              fontWeight: 950,
              letterSpacing: "0.06em",
              color: "#ffffff",
              background: "linear-gradient(135deg, #E040FB 0%, #7B1FA2 55%, #4A148C 100%)",
              border: "1px solid rgba(255,255,255,0.32)",
              boxShadow: "0 8px 22px rgba(123,47,190,0.45), inset 0 1px 0 rgba(255,255,255,0.28)",
              textShadow: "0 1px 3px rgba(0,0,0,0.55)",
              cursor: "pointer",
            }}
          >
            <Tr id="common.send" />
          </button>
        </div>
      </div>

      {llmGuide && (
        <AstralLlmSetupGuide
          initialProvider={llmGuide}
          onClose={() => setLlmGuide(null)}
        />
      )}
    </div>
  );
}

const astralPanelBtn: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 9,
  cursor: "pointer",
  background: "rgba(30,10,48,0.50)",
  border: "1px solid rgba(244,180,255,0.42)",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: 11,
  textShadow: "0 1px 2px rgba(0,0,0,0.55)",
};
