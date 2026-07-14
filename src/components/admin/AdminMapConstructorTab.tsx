import { useState } from "react";
import MapEditorPage from "../../pages/MapEditorPage";
import { EDITOR_MODES, type EditorMode } from "../../utils/mapEditorAPI";
import { textOnTintedAccent } from "../../utils/contrastText";

import { getAdminSetting } from "../../data/adminSettingsManifest";

interface Props {
  onEditorOpen?: (open: boolean) => void;
  fullscreen?: boolean;
}

export default function AdminMapConstructorTab({ onEditorOpen }: Props) {
  const [mode, setMode] = useState<EditorMode | null>(null);

  const closeEditor = () => {
    if (getAdminSetting<boolean>("live.map_constructor_warn", true) && !confirm("Выйти из редактора карт? Несохранённые изменения могут быть потеряны.")) {
      return;
    }
    setMode(null);
    onEditorOpen?.(false);
  };

  if (mode) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#060119" }}>
        <MapEditorPage
          variant="admin"
          initialMode={mode}
          onBack={closeEditor}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: "#69F0AE" }}>
          🛠️ Конструктор карт
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, maxWidth: 820 }}>
          Редактор 60×60 для разработчика: тайлы, спавны, публикация на сервер.
          Работает в горизонтальном режиме — поверните телефон как в игре.
          3D-тайлы загружаются с CDN сервера.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
        gap: 10,
      }}>
        {EDITOR_MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              onEditorOpen?.(true);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 88,
              padding: "14px 10px",
              borderRadius: 12,
              border: "1px solid rgba(105,240,174,0.35)",
              background: "rgba(105,240,174,0.12)",
              color: textOnTintedAccent("#69F0AE"),
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>{m.icon}</span>
            <span style={{ textAlign: "center", lineHeight: 1.25 }}>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
