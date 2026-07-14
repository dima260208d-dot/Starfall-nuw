import { useMemo, useState } from "react";
import type { UserProfile } from "../utils/localStorageAPI";
import { setProfileIcon } from "../utils/localStorageAPI";
import { PROFILE_ICONS } from "../data/profileIcons";
import { getProfileIconImage, isProfileIconUnlocked } from "../utils/profileIconUtils";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  profile: UserProfile;
  base: string;
  selectedId: string;
  onClose: () => void;
  onSelect: () => void;
  /** Override default setProfileIcon (e.g. intro bar slot). */
  onPick?: (iconId: string) => { success: boolean; error?: string };
}

export default function ProfileIconPicker({ profile, base, selectedId, onClose, onSelect, onPick }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "brawler" | "misc">("all");
  const icons = useMemo(() => {
    let list = PROFILE_ICONS.filter(i => filter === "all" || i.category === filter);
    if (filter === "all" || filter === "brawler") {
      list = list.filter(i => i.category !== "brawler" || profile.unlockedBrawlers.includes(i.id.replace("brawler:", "")));
    }
    return [...list].sort((a, b) => {
      const ua = isProfileIconUnlocked(profile, a.id) ? 1 : 0;
      const ub = isProfileIconUnlocked(profile, b.id) ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return a.id.localeCompare(b.id);
    });
  }, [profile, filter]);

  const handlePick = (id: string) => {
    const r = onPick ? onPick(id) : setProfileIcon(id);
    if (r.success) onSelect();
  };

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal>
      <div style={sheet} onClick={e => e.stopPropagation()}>
        <div style={headerRow}>
          <button type="button" onClick={onClose} style={navBtn} aria-label={t("common.back")}>←</button>
          <h2 style={title}><Tr id="profileIcon.pickTitle" /></h2>
          <button type="button" onClick={onClose} style={navBtn} aria-label={t("common.close")}>⌂</button>
        </div>

        <div style={filterRow}>
          {(["all", "brawler", "misc"] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                ...filterBtn,
                background: filter === f ? "rgba(206,147,216,0.35)" : "rgba(0,0,0,0.35)",
                borderColor: filter === f ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)",
              }}
            >
              {f === "all" ? t("common.all") : f === "brawler" ? t("common.brawlers") : t("common.other")}
            </button>
          ))}
        </div>

        <div style={gridWrap}>
          <div style={grid}>
            {icons.map(icon => {
              const unlocked = isProfileIconUnlocked(profile, icon.id);
              const active = icon.id === selectedId;
              return (
                <button
                  key={icon.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => handlePick(icon.id)}
                  title={unlocked ? undefined : t("common.locked")}
                  style={{
                    ...cell,
                    outline: active ? "3px solid #FFD700" : "none",
                    cursor: unlocked ? "pointer" : "default",
                  }}
                >
                  <img
                    src={getProfileIconImage(icon.id, base)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: unlocked ? "none" : "grayscale(1) brightness(0.72)",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9000,
  background: "rgba(8, 4, 24, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const sheet: React.CSSProperties = {
  width: "min(720px, 96vw)",
  maxHeight: "min(88vh, 640px)",
  display: "flex",
  flexDirection: "column",
  background: "linear-gradient(165deg, rgba(88, 40, 140, 0.92), rgba(24, 12, 48, 0.96))",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 20,
  boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "0.06em",
  color: "#fff",
  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
};

const navBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.4)",
  color: "#fff",
  fontSize: 18,
  cursor: "pointer",
  fontWeight: 800,
};

const filterRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "10px 14px",
  flexWrap: "wrap",
};

const filterBtn: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid",
  padding: "6px 14px",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const gridWrap: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "0 12px 14px",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 4,
  background: "rgba(0,0,0,0.35)",
  padding: 4,
  borderRadius: 12,
};

const cell: React.CSSProperties = {
  aspectRatio: "1",
  padding: 0,
  border: "2px solid rgba(0,0,0,0.5)",
  borderRadius: 4,
  overflow: "hidden",
  background: "#1a1028",
};
