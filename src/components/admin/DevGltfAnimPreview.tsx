import { useEffect, useState, type CSSProperties } from "react";
import Brawler3DModel, { getGltfAnimationNames } from "../Brawler3DModel";

interface Props {
  modelUrl: string;
  color: string;
  size?: number;
  visible: boolean;
  onLoadError?: () => void;
}

const arrowBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.55)",
  color: "white",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
  zIndex: 2,
};

export default function DevGltfAnimPreview({ modelUrl, color, size = 180, visible, onLoadError }: Props) {
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [animIndex, setAnimIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getGltfAnimationNames(modelUrl)
      .then((names) => {
        if (cancelled) return;
        setClipNames(names);
        setAnimIndex(0);
      })
      .catch(() => {
        if (!cancelled) {
          setClipNames([]);
          onLoadError?.();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [modelUrl, visible]);

  const count = clipNames.length;
  const currentName = count > 0 ? clipNames[animIndex]! : null;

  const step = (dir: -1 | 1) => {
    if (count <= 1) return;
    setAnimIndex(i => (i + dir + count) % count);
  };

  if (!visible) {
    return (
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, padding: 16, textAlign: "center" }}>
        Прокрутите сюда для загрузки 3D
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 6 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        gap: 4,
      }}>
        <button
          type="button"
          aria-label="Предыдущая анимация"
          disabled={count <= 1}
          onClick={(e) => { e.stopPropagation(); step(-1); }}
          style={{
            ...arrowBtnStyle,
            opacity: count <= 1 ? 0.35 : 1,
            cursor: count <= 1 ? "default" : "pointer",
          }}
        >
          ◀
        </button>

        <div style={{ flex: "0 0 auto", minWidth: 0 }}>
          {loading && count === 0 ? (
            <div style={{
              width: size,
              height: size,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
            }}>
              Загрузка…
            </div>
          ) : (
            <Brawler3DModel
              modelUrl={modelUrl}
              animation={currentName ?? "Idle"}
              color={color}
              size={size}
              autoRotateInitial={false}
              efficientPreview
              pixelRatioCap={1}
              showBackdrop={false}
            />
          )}
        </div>

        <button
          type="button"
          aria-label="Следующая анимация"
          disabled={count <= 1}
          onClick={(e) => { e.stopPropagation(); step(1); }}
          style={{
            ...arrowBtnStyle,
            opacity: count <= 1 ? 0.35 : 1,
            cursor: count <= 1 ? "default" : "pointer",
          }}
        >
          ▶
        </button>
      </div>

      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: currentName ? color : "rgba(255,255,255,0.45)",
        textAlign: "center",
        minHeight: 16,
        padding: "0 4px",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }} title={currentName ?? undefined}>
        {loading && count === 0
          ? "…"
          : currentName
            ? `Анимация: ${currentName}${count > 1 ? ` (${animIndex + 1}/${count})` : ""}`
            : "Нет анимаций"}
      </div>
    </div>
  );
}
