import { useMemo, useState } from "react";
import DevImportedModelCard from "./DevImportedModelCard";
import {
  DEV_IMPORTED_MODELS,
  DEV_MODEL_PACKS,
  getActiveDevMonsterModels,
  type DevModelPack,
} from "../../data/devImportedModels";
import { getDevImportedModelBaseUrl } from "../../data/devImportedModels";
import { getDisabledDevMonsterModelIds } from "../../utils/devMonsterModelPrefs";

export default function AdminImportedModelsTab() {
  const base = getDevImportedModelBaseUrl();
  const [pack, setPack] = useState<DevModelPack | "all">("all");
  const [query, setQuery] = useState("");
  /** Только для пересчёта счётчиков в шапке — не трогает key карточек. */
  const [disabledRevision, setDisabledRevision] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEV_IMPORTED_MODELS.filter(entry => {
      if (pack !== "all" && entry.pack !== pack) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.fileName.toLowerCase().includes(q) ||
        entry.packLabel.toLowerCase().includes(q)
      );
    });
  }, [pack, query]);

  const disabledMonsterCount = useMemo(
    () => getDisabledDevMonsterModelIds().length,
    [disabledRevision],
  );
  const activeMonsterCount = useMemo(
    () => getActiveDevMonsterModels().length,
    [disabledRevision],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: DEV_IMPORTED_MODELS.length };
    for (const e of DEV_IMPORTED_MODELS) {
      map[e.pack] = (map[e.pack] ?? 0) + 1;
    }
    return map;
  }, []);

  const gltfCount = filtered.filter(e => e.kind === "gltf").length;
  const objCount = filtered.filter(e => e.kind === "obj").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: "#FFD54F" }}>
          📦 Импортированные 3D-модели
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, maxWidth: 820 }}>
          Скачанные паки Big, Blob и мебель OBJ. Превью загружаются с CDN сервера.
          Тяните пальцем или мышью для вращения. Монстры (Big/Blob): ✕ на карточке убирает модель из тренировки и рейда босса.
          {disabledMonsterCount > 0 && (
            <span style={{ color: "#FF8A80" }}>
              {" "}Выключено: {disabledMonsterCount}. В игре: {activeMonsterCount}.
            </span>
          )}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {DEV_MODEL_PACKS.map(p => {
          const active = pack === p.id;
          const count = counts[p.id] ?? 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPack(p.id)}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: `1px solid ${active ? "#FFD54F" : "rgba(255,255,255,0.15)"}`,
                background: active ? "rgba(255,213,79,0.18)" : "rgba(255,255,255,0.05)",
                color: active ? "#FFD54F" : "white",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {p.label} ({count})
            </button>
          );
        })}
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Поиск по имени..."
        className="ui-input"
        style={{ maxWidth: 360 }}
      />

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
        Показано: {filtered.length} · GLTF: {gltfCount} · OBJ: {objCount}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          padding: 28,
          textAlign: "center",
          color: "rgba(255,255,255,0.5)",
          border: "1px dashed rgba(255,255,255,0.15)",
          borderRadius: 12,
        }}>
          Ничего не найдено
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}>
          {filtered.map(entry => (
            <DevImportedModelCard
              key={entry.id}
              entry={entry}
              baseUrl={base}
              onPrefsChange={() => setDisabledRevision(r => r + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
