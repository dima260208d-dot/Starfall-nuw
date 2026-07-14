import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { useI18n } from "../i18n";
import {
  createClub,
  CLUB_NAME_MAX, CLUB_DESC_MAX,
  type ClubType,
} from "../utils/clubs";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { getUnlockedProfileIconIds, getProfileIconImage } from "../utils/profileIconUtils";
import { DEFAULT_PROFILE_ICON_ID } from "../data/profileIcons";
import ClubAvatar from "./ClubAvatar";
import { EmojiIcon } from "./EmojiIcon";
import { textShadowOnSolidFill } from "../utils/contrastText";

interface Props {
  onCancel: () => void;
  onCreated: (clubId: string) => void;
}

export default function CreateClubModal({ onCancel, onCreated }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<ClubType>("open");
  const ownedIcons = useMemo(() => {
    const p = getCurrentProfile();
    return p ? getUnlockedProfileIconIds(p) : [];
  }, []);
  const [profileIconId, setProfileIconId] = useState<string>(
    () => getCurrentProfile()?.profileIconId || DEFAULT_PROFILE_ICON_ID,
  );
  const [err, setErr] = useState("");
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const cell = 48;

  const handleCreate = () => {
    if (!name.trim()) { setErr(t("clubs.createNameRequired")); return; }
    const r = createClub({
      name: name.trim(),
      description: desc.trim(),
      type,
      avatarProfileIconId: profileIconId,
    });
    if (r.success && r.club) onCreated(r.club.id);
    else setErr(r.error ?? t("common.error"));
  };

  const previewClub = {
    name: name || t("clubs.newClubDefault"),
    avatarProfileIconId: profileIconId,
  };

  // Render through a portal to <body> so the overlay is always sized to the real
  // viewport. ClubsPage uses framer-motion; a transformed ancestor would
  // otherwise trap `position: fixed` and make the window overflow the screen.
  return createPortal(
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(2,0,18,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 99999, padding: 16, boxSizing: "border-box",
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520,
        maxHeight: "90dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "linear-gradient(180deg, rgba(30,50,110,0.95) 0%, rgba(12,22,50,0.97) 100%)",
        border: "1.5px solid rgba(255,213,79,0.42)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
        borderRadius: 14, padding: 20,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 14, paddingBottom: 10,
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD54F", letterSpacing: 1.5 }}>
            <Tr id="clubs.createTitle" />
          </div>
          <button onClick={onCancel} style={iconCloseStyle}><EmojiIcon emoji="✕" size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <ClubAvatar club={previewClub} size={64} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
              {previewClub.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              {desc || t("common.noDescription")}
            </div>
          </div>
        </div>

        <Field label={t("clubs.field.name", { len: name.length, max: CLUB_NAME_MAX })}>
          <input
            value={name}
            onChange={e => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
            placeholder={t("clubs.namePlaceholder")}
            style={inputStyle()}
            maxLength={CLUB_NAME_MAX}
          />
        </Field>

        <Field label={t("clubs.field.desc", { len: desc.length, max: CLUB_DESC_MAX })}>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value.slice(0, CLUB_DESC_MAX))}
            placeholder={t("clubs.descPlaceholder")}
            rows={3}
            style={inputStyle()}
            maxLength={CLUB_DESC_MAX}
          />
        </Field>

        <Field label={t("clubs.field.entryType")}>
          <div style={{ display: "flex", gap: 8 }}>
            <TypeChoice
              active={type === "open"} color="#76FF03"
              icon="🚪" label={t("clubs.type.open")}
              sub={t("clubs.openSub")}
              onClick={() => setType("open")}
            />
            <TypeChoice
              active={type === "closed"} color="#FF7043"
              icon="🔒" label={t("clubs.type.closed")}
              sub={t("clubs.closedSub")}
              onClick={() => setType("closed")}
            />
          </div>
        </Field>

        <Field label={t("clubs.field.avatar")}>
          {ownedIcons.length === 0 ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}><Tr id="clubs.noProfileIcons" /></div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, ${cell}px)`,
              gap: 8,
              justifyContent: "start",
              maxHeight: 220,
              overflowY: "auto",
              overscrollBehavior: "contain",
              paddingRight: 2,
            }}>
              {ownedIcons.map(id => {
                const active = profileIconId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setProfileIconId(id)}
                    style={{
                      width: cell,
                      height: cell,
                      padding: 0,
                      border: active ? "2px solid #FFD54F" : "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      overflow: "hidden",
                      cursor: "pointer",
                      background: "rgba(0,0,0,0.35)",
                    }}
                  >
                    <img
                      src={getProfileIconImage(id, base)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {err && (
          <div style={{
            marginTop: 10, padding: 8, color: "#FF7070",
            background: "rgba(255,112,112,0.08)",
            border: "1px solid rgba(255,112,112,0.3)",
            borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center",
          }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={{
            flex: 1,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10, padding: "10px 0",
            color: "rgba(255,255,255,0.7)",
            fontWeight: 800, fontSize: 13, cursor: "pointer",
          }}><Tr id="common.cancel" /></button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            style={{
              flex: 2,
              background: name.trim()
                ? "linear-gradient(135deg, #FFD54F, #FF8A00)"
                : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 10, padding: "10px 0",
              color: name.trim() ? "#ffffff" : "rgba(255,255,255,0.3)",
              textShadow: name.trim() ? textShadowOnSolidFill() : undefined,
              fontWeight: 900, fontSize: 14, letterSpacing: 1.5,
              cursor: name.trim() ? "pointer" : "default",
              boxShadow: name.trim() ? "0 4px 14px rgba(255,213,79,0.5)" : "none",
            }}
          ><Tr id="clubs.createBtn" /></button>
        </div>
      </div>
    </div>,
    getAppPortalRoot(),
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <label style={{
        display: "block", fontSize: 10, color: "rgba(255,255,255,0.55)",
        fontWeight: 700, letterSpacing: 1.5, marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

function TypeChoice({ active, color, icon, label, sub, onClick }: {
  active: boolean; color: string; icon: string; label: string; sub: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      background: active ? `${color}26` : "rgba(0,0,0,0.4)",
      border: `1.5px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
      borderRadius: 10, padding: "10px 8px",
      color: active ? color : "white",
      cursor: "pointer", textAlign: "left",
      boxShadow: active ? `0 0 12px ${color}55` : "none",
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}><EmojiIcon emoji={icon} size={18} /></div>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{sub}</div>
    </button>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8, padding: "8px 10px",
    color: "white", fontSize: 13, fontWeight: 600,
    fontFamily: "inherit",
  };
}

const iconCloseStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8, padding: "4px 10px",
  color: "white", cursor: "pointer", fontWeight: 800,
};
