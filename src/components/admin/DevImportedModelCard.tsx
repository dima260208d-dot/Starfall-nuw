import { useEffect, useRef, useState } from "react";
import DevObjModelPreview from "./DevObjModelPreview";
import DevGltfAnimPreview from "./DevGltfAnimPreview";
import type { DevImportedModelEntry } from "../../data/devImportedModels";
import {
  devImportedModelUrl,
} from "../../data/devImportedModels";
import { alternateHeavyAssetUrl } from "../../lib/assetBase";
import {
  disableDevMonsterModel,
  enableDevMonsterModel,
  isDevMonsterModelDisabled,
} from "../../utils/devMonsterModelPrefs";

interface Props {
  entry: DevImportedModelEntry;
  baseUrl: string;
  onPrefsChange?: () => void;
}

export default function DevImportedModelCard({ entry, baseUrl, onPrefsChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const isMonster = entry.pack === "big" || entry.pack === "blob";
  const [disabled, setDisabled] = useState(() => isMonster && isDevMonsterModelDisabled(entry.id));

  useEffect(() => {
    if (isMonster) setDisabled(isDevMonsterModelDisabled(entry.id));
  }, [entry.id, isMonster]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([hit]) => setVisible(hit.isIntersecting),
      { rootMargin: "120px", threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [assetUrl, setAssetUrl] = useState(() => devImportedModelUrl(baseUrl, entry));
  const [mtlUrl, setMtlUrl] = useState(() =>
    entry.mtlPath ? devImportedModelUrl(baseUrl, { ...entry, assetPath: entry.mtlPath }) : "",
  );

  useEffect(() => {
    setAssetUrl(devImportedModelUrl(baseUrl, entry));
    setMtlUrl(entry.mtlPath ? devImportedModelUrl(baseUrl, { ...entry, assetPath: entry.mtlPath }) : "");
  }, [baseUrl, entry]);

  const retryAlternateUrl = (failedUrl: string) => {
    const alt = alternateHeavyAssetUrl(failedUrl);
    if (alt && alt !== failedUrl) setAssetUrl(alt);
  };

  const assetBase = (() => {
    const idx = assetUrl.indexOf(entry.assetPath);
    return idx >= 0 ? assetUrl.slice(0, idx) : baseUrl;
  })();
  const hasPreview = entry.kind === "gltf" || entry.kind === "obj";

  const toggleMonsterInGame = () => {
    if (!isMonster) return;
    if (disabled) {
      enableDevMonsterModel(entry.id);
      setDisabled(false);
    } else {
      disableDevMonsterModel(entry.id);
      setDisabled(true);
    }
    onPrefsChange?.();
  };

  return (
    <div
      ref={rootRef}
      style={{
        background: disabled ? "rgba(40,0,0,0.55)" : "rgba(0,0,0,0.45)",
        border: `1px solid ${disabled ? "#F4433688" : `${entry.color}44`}`,
        borderRadius: 12,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 280,
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            color: disabled ? "#FF8A80" : "white",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }} title={entry.name}>
            {entry.name}
            {disabled ? " · выкл." : ""}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            {entry.packLabel} · {entry.kind.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {isMonster && (
            <button
              type="button"
              onClick={toggleMonsterInGame}
              title={disabled ? "Вернуть в игру" : "Убрать из игры (тренировка и рейд босса)"}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: disabled ? "#81C784" : "#FF8A80",
                padding: "4px 8px",
                borderRadius: 6,
                border: `1px solid ${disabled ? "#81C78466" : "#F4433666"}`,
                background: "rgba(0,0,0,0.35)",
                cursor: "pointer",
              }}
            >
              {disabled ? "↩" : "✕"}
            </button>
          )}
          <a
            href={assetUrl}
            download={entry.fileName}
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: entry.color,
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${entry.color}66`,
              background: "rgba(0,0,0,0.35)",
            }}
          >
            ⬇
          </a>
        </div>
      </div>

      {hasPreview ? (
        <div style={{
          flex: 1,
          minHeight: 220,
          borderRadius: 10,
          overflow: "hidden",
          background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(0,0,0,0.85))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          {visible ? (
            entry.kind === "gltf" ? (
              <DevGltfAnimPreview
                modelUrl={assetUrl}
                color={entry.color}
                size={180}
                visible={visible}
                onLoadError={() => retryAlternateUrl(assetUrl)}
              />
            ) : (
              <DevObjModelPreview
                objUrl={assetUrl}
                mtlUrl={mtlUrl}
                assetBase={assetBase}
                color={entry.color}
                size={220}
                pixelRatioCap={1}
              />
            )
          ) : (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, padding: 16, textAlign: "center" }}>
              Прокрутите сюда для загрузки 3D
            </div>
          )}
          {disabled && isMonster && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.45)",
              color: "#FF8A80",
              fontWeight: 800,
              fontSize: 13,
            }}>
              Не в игре
            </div>
          )}
        </div>
      ) : null}

      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
        {entry.kind === "gltf"
          ? "◀ ▶ — переключить анимацию · тяните модель для вращения"
          : isMonster
            ? (disabled ? "Модель скрыта из тренировки и рейда босса" : "✕ — убрать из игры")
            : (hasPreview ? "Тяните мышью / палец — вращение модели" : entry.fileName)}
      </div>
    </div>
  );
}
