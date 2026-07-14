import { useState } from "react";
import {
  loadGestureLayout,
  saveGestureLayout,
  resetGestureLayout,
  type GestureControlLayout,
  type GestureAnchor,
} from "../utils/gestureLayout";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

export type GestureEditTarget = "move" | "attack" | "super" | "emoji" | "autobattle";

interface Props {
  open: boolean;
  onClose: () => void;
  selected: GestureEditTarget | null;
  onSelect: (t: GestureEditTarget | null) => void;
  onLayoutChange: (layout: GestureControlLayout) => void;
}

const STICK_KEYS: GestureEditTarget[] = ["move", "attack", "super"];
const EXTRA_KEYS: GestureEditTarget[] = ["emoji", "autobattle"];

export default function TrainingGestureEditor({
  open,
  onClose,
  selected,
  onSelect,
  onLayoutChange,
}: Props) {
  const { t } = useI18n();
  const [layout, setLayout] = useState(loadGestureLayout);

  const patch = (next: GestureControlLayout) => {
    setLayout(next);
    saveGestureLayout(next);
    onLayoutChange(next);
  };

  const sel = selected;
  const stickSel = sel && STICK_KEYS.includes(sel) ? sel : null;
  const extraSel = sel && EXTRA_KEYS.includes(sel) ? sel : null;

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        pointerEvents: "auto",
        width: "min(92vw, 420px)",
        background: "rgba(8,12,28,0.94)",
        border: "1px solid rgba(66,165,245,0.45)",
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 900, fontSize: 14, color: "#90CAF9", letterSpacing: 0.5 }}>
          <Tr id="training.gestureEditor.title" />
        </span>
        <button type="button" onClick={onClose} className="ui-btn ui-btn--secondary" style={{ padding: "4px 10px", fontSize: 12 }}>
          ✕
        </button>
      </div>

      <div style={{ fontSize: 11, color: "var(--t-3)", marginBottom: 8 }}>
        <Tr id="training.gestureEditor.hint" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {([...STICK_KEYS, ...EXTRA_KEYS] as GestureEditTarget[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(sel === key ? null : key)}
            className={`ui-btn ${sel === key ? "ui-btn--primary" : "ui-btn--secondary"}`}
            style={{ fontSize: 11, padding: "6px 10px" }}
          >
            {t(`training.gestureEditor.${key}`)}
          </button>
        ))}
      </div>

      {stickSel && (
        <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: "var(--t-2)" }}>
            <Tr id="training.gestureEditor.anchor" />
            <select
              value={layout[stickSel].anchor}
              onChange={(e) => {
                const anchor = e.target.value as GestureAnchor;
                patch({ ...layout, [stickSel]: { ...layout[stickSel], anchor } });
              }}
              style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6 }}
            >
              <option value="fixed">{t("training.gestureEditor.fixed")}</option>
              <option value="floating">{t("training.gestureEditor.floating")}</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: "var(--t-2)", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={layout[stickSel].mirror}
              onChange={(e) => patch({ ...layout, [stickSel]: { ...layout[stickSel], mirror: e.target.checked } })}
            />
            <Tr id="training.gestureEditor.mirror" />
          </label>
          <label style={{ fontSize: 12, color: "var(--t-2)" }}>
            <Tr id="training.gestureEditor.size" params={{ pct: Math.round(layout[stickSel].size * 100) }} />
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={layout[stickSel].size}
              onChange={(e) => patch({ ...layout, [stickSel]: { ...layout[stickSel], size: Number(e.target.value) } })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
        </div>
      )}

      {extraSel && (
        <label style={{ fontSize: 12, color: "var(--t-2)", display: "block", marginBottom: 8 }}>
          <Tr id="training.gestureEditor.size" params={{ pct: Math.round(layout[extraSel].size * 100) }} />
          <input
            type="range"
            min={0.6}
            max={1.4}
            step={0.05}
            value={layout[extraSel].size}
            onChange={(e) => patch({ ...layout, [extraSel]: { ...layout[extraSel], size: Number(e.target.value) } })}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          style={{ flex: 1, fontSize: 11 }}
          onClick={() => {
            resetGestureLayout();
            const d = loadGestureLayout();
            setLayout(d);
            onLayoutChange(d);
          }}
        >
          <Tr id="training.gestureEditor.reset" />
        </button>
      </div>
    </div>
  );
}
