import { useState } from "react";
import type { GameMode } from "../App";
import type { GameParticipant } from "../types/gameResult";
import { REPORT_CATEGORIES, type ReportCategoryId } from "../data/reportCategories";
import { submitPlayerReport } from "../utils/playerReports";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  mode: GameMode;
  opponents: GameParticipant[];
  visible: boolean;
  onClose: () => void;
}

export default function ResultReportFlow({ mode, opponents, visible, onClose }: Props) {
  const { t } = useI18n();
  const [target, setTarget] = useState<GameParticipant | null>(null);
  const [category, setCategory] = useState<ReportCategoryId | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const profile = getCurrentProfile();
  const reportable = opponents.filter((p) => !p.isPlayer);

  const pickParticipant = (p: GameParticipant) => setTarget(p);

  if (!visible) return null;

  const reset = () => {
    setTarget(null);
    setCategory(null);
    setDescription("");
    setStatus("");
  };

  const send = async () => {
    if (!target || !category || !profile?.playerId) return;
    setBusy(true);
    const r = await submitPlayerReport({
      reporterPlayerId: profile.playerId,
      reporterUsername: profile.username,
      reportedPlayerId: target.displayName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || target.displayName,
      reportedUsername: target.displayName,
      category,
      description: description.trim(),
      battleMode: mode,
    });
    setBusy(false);
    if (r.ok) {
      setStatus(t("report.sent"));
      setTimeout(() => { reset(); onClose(); }, 1500);
    } else {
      setStatus(t("report.failed"));
    }
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, background: "rgba(4,8,18,0.92)",
    }}>
      {!target && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
            <Tr id="report.pickPlayer" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 720 }}>
            {reportable.map((p) => (
              <button
                key={p.displayName + p.brawlerId}
                type="button"
                onClick={() => pickParticipant(p)}
                className="ui-btn ui-btn--secondary"
                style={{ minWidth: 140, padding: "12px 16px" }}
              >
                {p.displayName}
              </button>
            ))}
          </div>
          {reportable.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 12 }}>
              <Tr id="report.noTargets" />
            </div>
          )}
        </>
      )}

      {target && !category && (
        <>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#FF8A80", marginBottom: 8 }}>
            <Tr id="report.title" /> — {target.displayName}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12, maxWidth: 760, width: "100%",
          }}>
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                style={{
                  textAlign: "left", padding: 0, border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.45)", cursor: "pointer",
                }}
              >
                <img src={cat.imageUrl} alt="" style={{ width: "100%", height: 88, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{t(cat.titleKey)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4, lineHeight: 1.35 }}>
                    {t(cat.descKey)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button type="button" className="ui-btn ui-btn--ghost" style={{ marginTop: 16 }} onClick={() => setTarget(null)}>
            <Tr id="common.back" />
          </button>
        </>
      )}

      {target && category && (
        <>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 10 }}>
            {t(REPORT_CATEGORIES.find((c) => c.id === category)!.titleKey)}
          </div>
          <textarea
            className="ui-input"
            placeholder={t("report.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 400))}
            style={{ width: "min(480px, 92vw)", minHeight: 80, marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setCategory(null)} disabled={busy}>
              <Tr id="common.back" />
            </button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => void send()} disabled={busy}>
              {busy ? t("report.sending") : t("report.submit")}
            </button>
          </div>
        </>
      )}

      {status && (
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: status.includes("✓") || status === t("report.sent") ? "#3ad29f" : "#ff6b6b" }}>
          {status}
        </div>
      )}

      <button
        type="button"
        className="ui-btn ui-btn--ghost"
        style={{ position: "absolute", top: 20, left: 20 }}
        onClick={() => { reset(); onClose(); }}
      >
        ✕
      </button>
    </div>
  );
}
