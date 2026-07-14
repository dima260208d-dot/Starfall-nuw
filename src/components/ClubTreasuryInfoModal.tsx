import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { publicAssetBase } from "../utils/modeAssets";
import { useI18nOptional } from "../i18n/I18nProvider";
import { Tr } from "../i18n/Tr";

const BG = `${publicAssetBase}images/club-treasury-info-bg.png`;

interface Props {
  onClose: () => void;
}

export default function ClubTreasuryInfoModal({ onClose }: Props) {
  const { t } = useI18nOptional();

  return createPortal(
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999991,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        background: "rgba(0,0,0,0.78)",
        fontFamily: "var(--app-font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          maxHeight: "min(88vh, 640px)",
          position: "relative",
          borderRadius: 16,
          boxShadow: "0 20px 56px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{
          position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", pointerEvents: "none",
        }}>
          <img src={BG} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, padding: "14px 18px 18px", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#FFD740" }}><Tr id="clubs.treasury.infoTitle" /></div>
            <button type="button" onClick={onClose} style={{
              background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1,
            }}>×</button>
          </div>
          <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontWeight: 800 }}><Tr id="clubs.treasury.infoFairTitle" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoFair1" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoFair2" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoFair3" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoFair4" /></p>
            <p style={{ margin: 0, fontWeight: 800, marginTop: 4 }}><Tr id="clubs.treasury.infoExampleTitle" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoExampleAssumptions" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoExampleContrib" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoExampleTotal" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoScenarioA" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoScenarioB" /></p>
            <p style={{ margin: 0, fontWeight: 700, color: "#FFD740" }}><Tr id="clubs.treasury.infoConclusion" /></p>
            <p style={{ margin: 0, fontWeight: 800, marginTop: 4 }}><Tr id="clubs.treasury.infoVoteTitle" /></p>
            <p style={{ margin: 0 }}><Tr id="clubs.treasury.infoVoteDesc" /></p>
          </div>
        </div>
      </div>
    </div>,
    getAppPortalRoot(),
  );
}
