import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { getCurrentProfile } from "../../utils/localStorageAPI";
import { normalizePlayerIdQuery } from "../../utils/playerId";
import ChatPinTray from "../ChatPinTray";
import ModeIconImg from "../ModeIconImg";
import { getModeInfo } from "../../data/modes";
import {
  getPartyChatMessages,
  markPartyChatRead,
  sendPartyChatPin,
  sendPartyChatText,
  scheduleGuardianAiPartyRescan,
} from "../../utils/social/partyChat";
import {
  PARTY_CHANGED_EVENT,
  cancelPartyModeSuggestion,
} from "../../utils/social/party";
import { ChatPinBubble } from "../ChatPinBubble";
import { BtnOnIcon, EmojiIcon, TextWithEmojis } from "../EmojiIcon";
import { Tr } from "../../i18n/Tr";
import { PARTY_CHAT_PANEL_WIDTH } from "./PartySidePanel";
import { UI_BUTTON_ICONS } from "../../data/uiButtonIcons";

const PIN_COOLDOWN_MS = 2500;

const PANEL_BG =
  "linear-gradient(180deg, rgba(36,18,72,0.72) 0%, rgba(12,6,32,0.78) 52%, rgba(24,12,52,0.70) 100%)";

interface Props {
  brawlerId: string;
  onClose: () => void;
  onSuggestModeChange?: () => void;
}

export default function PartyChatPanel({ brawlerId, onClose, onSuggestModeChange }: Props) {
  const { t, localeMeta } = useI18n();
  const [text, setText] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [tick, setTick] = useState(0);
  const [pinCooldownUntil, setPinCooldownUntil] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bump = () => setTick(n => n + 1);
    window.addEventListener(PARTY_CHANGED_EVENT, bump);
    return () => window.removeEventListener(PARTY_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    scheduleGuardianAiPartyRescan(2500);
  }, []);

  const messages = getPartyChatMessages();
  void tick;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    markPartyChatRead();
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const sendText = async () => {
    const r = await sendPartyChatText(text);
    if (r.success) setText("");
    setTick(n => n + 1);
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  const sendPin = (pinId: string) => {
    if (Date.now() < pinCooldownUntil) return;
    const r = sendPartyChatPin(pinId, brawlerId);
    if (r.success) {
      setPinCooldownUntil(Date.now() + PIN_COOLDOWN_MS);
      setShowPins(false);
      setTick(n => n + 1);
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  };

  const pinCooldown = Date.now() < pinCooldownUntil;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 52, background: "rgba(2,0,18,0.12)" }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          right: 0,
          width: PARTY_CHAT_PANEL_WIDTH,
          maxWidth: "96vw",
          zIndex: 53,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "partySlideInRight 0.22s ease-out",
          background: PANEL_BG,
          borderLeft: "1px solid rgba(206,147,216,0.42)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          fontFamily: "var(--app-font-sans)",
        }}
      >
        <style>{`
          @keyframes partySlideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#CE93D8", letterSpacing: "0.02em" }}>
            <Tr id="party.chatTitle" />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "5px 10px",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            <EmojiIcon emoji="✕" size={20} />
          </button>
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", padding: "48px 16px", fontSize: 15 }}>
              <Tr id="party.chatEmpty" />
            </div>
          ) : (
            messages.map(m => {
              const me = getCurrentProfile();
              const isMine = !!(me?.playerId && normalizePlayerIdQuery(m.playerId) === normalizePlayerIdQuery(me.playerId));

              if (m.system) {
                return (
                  <div key={m.id} style={{
                    alignSelf: "center", maxWidth: "92%",
                    padding: "6px 12px",
                    background: "rgba(255,213,79,0.08)",
                    border: "1px solid rgba(255,213,79,0.3)",
                    borderRadius: 8,
                    fontSize: 11, color: "#FFD54F", fontWeight: 700, textAlign: "center",
                  }}>
                    <TextWithEmojis text={m.text} emojiSize={24} />
                  </div>
                );
              }

              if (m.modeSuggest && m.modeId) {
                const mode = getModeInfo(m.modeId);
                return (
                  <div key={m.id} style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                    gap: 8,
                  }}>
                    {!isMine && (
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#CE93D8", padding: "0 4px" }}>
                        {m.username}
                      </div>
                    )}
                    <div style={{
                      maxWidth: "92%",
                      background: isMine
                        ? "linear-gradient(135deg, #7B1FA2, #4A148C)"
                        : "rgba(255,255,255,0.08)",
                      border: `1px solid ${isMine ? "rgba(206,147,216,0.45)" : "rgba(255,255,255,0.12)"}`,
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", textAlign: "center" }}>
                        <Tr id="party.modeSuggestChat" params={{ name: m.username, mode: mode.name }} />
                      </div>
                      <ModeIconImg modeId={mode.id} alt={mode.name} size={56} />
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{mode.name}</div>
                      {isMine && (
                        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="ui-btn ui-btn--secondary"
                            style={{ fontSize: 11, minHeight: 0, padding: "6px 12px", fontWeight: 800 }}
                            onClick={() => { cancelPartyModeSuggestion(); setTick(n => n + 1); }}
                          >
                            <Tr id="party.modeSuggestCancel" />
                          </button>
                          {onSuggestModeChange && (
                            <button
                              type="button"
                              className="ui-btn ui-btn--primary"
                              style={{ fontSize: 11, minHeight: 0, padding: "6px 12px", fontWeight: 800 }}
                              onClick={onSuggestModeChange}
                            >
                              <Tr id="party.modeSuggestChange" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (m.astral) {
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#CE93D8", marginBottom: 3, padding: "0 4px" }}>
                      {m.username}
                    </div>
                    <div style={{
                      maxWidth: "85%",
                      background: "linear-gradient(135deg, rgba(123,31,162,0.45), rgba(74,20,140,0.55))",
                      border: "1px solid rgba(206,147,216,0.55)",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 14,
                      color: "#F3E5F5",
                      lineHeight: 1.35,
                      wordBreak: "break-word",
                    }}>
                      <TextWithEmojis text={m.text} emojiSize={24} />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                  }}
                >
                  {!isMine && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#CE93D8", marginBottom: 3, padding: "0 4px" }}>
                      {m.username}
                    </div>
                  )}
                  {m.pinId ? (
                    <ChatPinBubble pinId={m.pinId} size={72} />
                  ) : (
                    <div style={{
                      maxWidth: "85%",
                      background: isMine
                        ? "linear-gradient(135deg, #7B1FA2, #4A148C)"
                        : "rgba(255,255,255,0.07)",
                      border: `1px solid ${isMine ? "rgba(206,147,216,0.45)" : "rgba(255,255,255,0.12)"}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 14,
                      color: "#fff",
                      lineHeight: 1.35,
                      wordBreak: "break-word",
                    }}>
                      <TextWithEmojis text={m.text} emojiSize={24} />
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, padding: "0 4px" }}>
                    {new Date(m.sentAt).toLocaleString(localeMeta.bcp47, {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {showPins && (
          <div style={{
            padding: "8px 14px 0",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}>
            <ChatPinTray
              brawlerId={brawlerId}
              onPick={sendPin}
              disabled={pinCooldown}
              compact
            />
          </div>
        )}

        <div style={{
          display: "flex",
          gap: 8,
          padding: "14px 18px 18px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}>
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            title={t("chatPin.title")}
            disabled={pinCooldown}
            onClick={() => setShowPins(v => !v)}
            style={{ minWidth: 48, minHeight: 0, padding: "10px 12px" }}
          >
            <BtnOnIcon src={UI_BUTTON_ICONS.character.pins} size={28} glowColor="#7E57C2" alt={t("chatPin.title")} />
          </button>
          <input
            className="ui-input"
            value={text}
            onChange={e => setText(e.target.value.slice(0, 120))}
            onKeyDown={e => { if (e.key === "Enter") sendText(); }}
            placeholder={t("party.chatPlaceholder")}
            style={{ flex: 1, minHeight: 0, fontSize: 15 }}
          />
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={sendText}
            disabled={!text.trim()}
            style={{ minHeight: 0, padding: "8px 16px", fontWeight: 800 }}
          >
            <Tr id="common.send" />
          </button>
        </div>
      </div>
    </>
  );
}
