import { useEffect, useRef, useState } from "react";
import { GAME_LOCALES, useI18n, type LocaleCode } from "../i18n";
import { textOnTintedAccent } from "../utils/contrastText";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

export default function LanguagePicker() {
  const { locale, localeMeta, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (code: LocaleCode) => {
    setLocale(code);
    setOpen(false);
  };

  const accent = "#7E57C2";

  return (
    <div ref={rootRef} style={{ position: "relative", marginBottom: 8 }}>
      <div
        className="ui-card"
        style={{
          padding: "14px 16px",
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--t-3)", fontWeight: 700, letterSpacing: 1.5 }}>
            <Tr id="settings.language.current" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{localeMeta.nativeName}</div>
          <div style={{ fontSize: 11, color: "var(--t-3)", marginTop: 6, lineHeight: 1.4, maxWidth: 280 }}>
            <Tr id="settings.language.hint" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ui-btn"
          style={{
            ["--ui-shear-fill" as string]: `linear-gradient(135deg, ${accent}44, ${accent}18)`,
            ["--ui-shear-border" as string]: accent,
            ["--ui-shear-text" as string]: textOnTintedAccent(accent),
            fontWeight: 800,
            fontSize: 13,
            padding: "10px 16px",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          <Tr id="settings.language.change" />
        </button>
      </div>

      {open && (
        <div
          className="ui-glass"
          role="listbox"
          aria-label={t("settings.language.pick")}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
            padding: 8,
            marginTop: 4,
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--sh-lg)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--t-3)",
              fontWeight: 700,
              letterSpacing: 1.5,
              padding: "6px 10px 8px",
            }}
          >
            <Tr id="settings.language.pick" />
          </div>
          {GAME_LOCALES.map((loc) => {
            const active = loc.code === locale;
            return (
              <button
                key={loc.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(loc.code)}
                style={{
                  width: "100%",
                  textAlign: "start",
                  padding: "10px 12px",
                  marginBottom: 2,
                  borderRadius: "var(--r-md)",
                  border: active ? `1px solid ${accent}` : "1px solid transparent",
                  background: active
                    ? `linear-gradient(135deg, ${accent}33, rgba(8,4,24,0.6))`
                    : "transparent",
                  color: "var(--t-1)",
                  cursor: "pointer",
                  fontWeight: active ? 800 : 600,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>{loc.nativeName}</span>
                {active && (
                  <span style={{ color: accent, fontSize: 12 }}><EmojiIcon emoji="✓" size={20} /></span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
