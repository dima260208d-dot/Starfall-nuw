import { getCurrentProfile } from "../utils/localStorageAPI";
import {
  SIEGE_MAX_LEVEL,
  getSiegeCurrentLevel,
  getSiegeMaxWaves,
  isSiegeLevelCleared,
} from "../utils/siegeProgress";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

type SiegeLevelPanelProps = {
  compact?: boolean;
};

export default function SiegeLevelPanel({ compact = false }: SiegeLevelPanelProps) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const current = getSiegeCurrentLevel(profile);

  if (compact) {
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8, letterSpacing: 1.2, fontWeight: 700 }}>
          <Tr id="siege.levels" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Array.from({ length: SIEGE_MAX_LEVEL }, (_, i) => i + 1).map((lv) => {
            const done = isSiegeLevelCleared(profile, lv);
            const locked = lv > current;
            const waves = getSiegeMaxWaves(lv);
            const active = lv === current;
            return (
              <div
                key={lv}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 8,
                  background: locked
                    ? "rgba(0,0,0,0.28)"
                    : done
                      ? "rgba(30,40,55,0.72)"
                      : active
                        ? "rgba(60,90,120,0.38)"
                        : "rgba(255,255,255,0.05)",
                  border: `1px solid ${done ? "rgba(100,200,120,0.25)" : active ? "rgba(100,180,255,0.32)" : "rgba(255,255,255,0.08)"}`,
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    width: 18,
                    fontSize: 11,
                    fontWeight: 900,
                    textAlign: "center",
                    color: done ? "#81C784" : active ? "#64B5F6" : "rgba(255,255,255,0.85)",
                    flexShrink: 0,
                  }}
                >
                  {done ? <EmojiIcon emoji="✓" size={18} /> : lv}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.9)", flex: 1, minWidth: 0 }}>
                  <Tr id="siege.levelShort" params={{ level: lv, count: waves }} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.95)", lineHeight: 1.1 }}>
        <Tr id="siege.levels" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 1 }}>
        {Array.from({ length: SIEGE_MAX_LEVEL }, (_, i) => i + 1).map((lv) => {
          const done = isSiegeLevelCleared(profile, lv);
          const locked = lv > current;
          const waves = getSiegeMaxWaves(lv);
          const active = lv === current;
          return (
            <div
              key={lv}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                padding: "3px 5px",
                borderRadius: 8,
                background: locked
                  ? "rgba(0,0,0,0.38)"
                  : done
                    ? "rgba(30,40,55,0.88)"
                    : active
                      ? "rgba(60,90,120,0.42)"
                      : "rgba(60,40,90,0.42)",
                border: `1px solid ${done ? "rgba(100,200,120,0.28)" : active ? "rgba(100,180,255,0.35)" : "rgba(255,255,255,0.1)"}`,
                opacity: locked ? 0.55 : 1,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: done ? "#81C784" : active ? "#64B5F6" : "rgba(255,255,255,0.88)",
                  minWidth: 14,
                  textAlign: "center",
                }}
              >
                {done ? <EmojiIcon emoji="✓" size={18} /> : lv}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.92)", lineHeight: 1.15 }}>
                  <Tr id="siege.levelLabel" params={{ level: lv }} />
                </div>
                <div style={{ fontSize: 9, opacity: 0.72, lineHeight: 1.1 }}>
                  <Tr id="siege.levelWaves" params={{ count: waves }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}