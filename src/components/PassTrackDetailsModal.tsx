import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import ChestVisual from "./ChestVisual";
import { CHEST_MODELS } from "./Chest3DViewer";
import { prewarmFrozenSpinningModelSnapshot } from "./SpinningModel3D";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import PinIcon from "./PinIcon";
import { getProfileIconImage } from "../utils/profileIconUtils";
import { publicAssetBase } from "../utils/modeAssets";
import { chestEntries, type PassTrackSummaryRow } from "../utils/passTrackSummary";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../utils/chests";
import { chestShortName, useI18n } from "../i18n";
import InfoIconButton from "./InfoIconButton";
import { EmojiIcon } from "./EmojiIcon";

export type PassDetailsVariant = "clash" | "pro";

const BG: Record<PassDetailsVariant, string> = {
  clash: `${publicAssetBase}images/pass-details-clash-bg.png`,
  pro: `${publicAssetBase}images/pass-details-pro-bg.png`,
};

const ICON = 30;
export const PASS_DETAILS_CHEST_ICON = 52;
const ROW_H = 34;

/** Параметры рендера сундуков — совпадают с ChestVisual в списке наград. */
const PASS_DETAILS_CHEST_RENDER = {
  size: PASS_DETAILS_CHEST_ICON,
  ambientMult: 1.8,
  dirMult: 2.2,
  cameraPos: [0, 1.0, 3.8] as [number, number, number],
  lookAtPos: [0, 0.45, 0] as [number, number, number],
};

/** Прогрев GLB + PNG-снимков сундуков — вызывать при входе на страницу пасса. */
export function preloadPassDetailsChestModels(rarities: ChestRarity[] = CHEST_RARITY_ORDER): Promise<void> {
  return rarities.reduce(
    (chain, rarity) => chain.then(() =>
      prewarmFrozenSpinningModelSnapshot({
        modelPath: CHEST_MODELS[rarity],
        color: CHESTS[rarity].color,
        ...PASS_DETAILS_CHEST_RENDER,
      }).catch(() => {}),
    ),
    Promise.resolve(),
  );
}

export function preloadPassDetailsChestModelsFromTracks(tracks: PassTrackSummaryRow[]): Promise<void> {
  const rarities = new Set<ChestRarity>();
  for (const track of tracks) {
    for (const entry of chestEntries(track.totals)) rarities.add(entry.rarity);
  }
  const ordered = CHEST_RARITY_ORDER.filter((r) => rarities.has(r));
  return preloadPassDetailsChestModels(ordered.length > 0 ? ordered : CHEST_RARITY_ORDER);
}

interface Props {
  variant: PassDetailsVariant;
  tracks: PassTrackSummaryRow[];
  onClose: () => void;
}

export function PassInfoButton(props: { onClick: () => void; style?: CSSProperties }) {
  const preload = () => { void preloadPassDetailsChestModels(); };
  return (
    <div onMouseEnter={preload} onFocus={preload} style={{ display: "inline-flex" }}>
      <InfoIconButton {...props} />
    </div>
  );
}

function StatRow({
  icon, label, iconBox = ICON,
}: { icon: ReactNode; label: string; iconBox?: number }) {
  const rowH = Math.max(ROW_H, iconBox + 2);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: rowH,
        minHeight: rowH,
      }}
    >
      <div
        style={{
          width: iconBox,
          height: iconBox,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
          position: "relative",
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#fff",
          lineHeight: 1.2,
          textShadow: "0 1px 3px rgba(0,0,0,0.85)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function TrackColumn({ trackKey, totals }: PassTrackSummaryRow) {
  const { t } = useI18n();
  const chests = chestEntries(totals);
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6, overflow: "visible" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          color: "#FFD740",
          textShadow: "0 1px 4px rgba(0,0,0,0.9)",
          marginBottom: 2,
          lineHeight: 1.2,
        }}
      >
        {t(trackKey)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "visible" }}>
        {totals.coins > 0 && (
          <StatRow
            icon={<CoinIcon size={ICON} static />}
            label={t("pass.details.coins", { count: fmt(totals.coins) })}
          />
        )}
        {totals.gems > 0 && (
          <StatRow
            icon={<GemIcon size={ICON} static />}
            label={t("pass.details.gems", { count: fmt(totals.gems) })}
          />
        )}
        {totals.powerPoints > 0 && (
          <StatRow
            icon={<PowerIcon size={ICON} static />}
            label={t("pass.details.power", { count: fmt(totals.powerPoints) })}
          />
        )}
        {chests.map((c) => (
          <StatRow
            key={c.rarity}
            iconBox={PASS_DETAILS_CHEST_ICON}
            icon={
              <ChestVisual
                rarity={c.rarity}
                size={PASS_DETAILS_CHEST_ICON}
                animated={false}
              />
            }
            label={t("pass.details.chests", { rarity: chestShortName(c.rarity), count: c.count })}
          />
        ))}
        {totals.pins > 0 && (
          <StatRow
            icon={
              totals.samplePinId
                ? <PinIcon pinId={totals.samplePinId} size={ICON} glow bare />
                : <span style={{ fontSize: 22 }}><EmojiIcon emoji="📌" size={24} /></span>
            }
            label={t("pass.details.pins", { count: totals.pins })}
          />
        )}
        {totals.profileIcons > 0 && (
          <StatRow
            icon={
              totals.sampleIconId ? (
                <img
                  src={getProfileIconImage(totals.sampleIconId)}
                  alt=""
                  width={ICON}
                  height={ICON}
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: 22 }}><EmojiIcon emoji="🖼" size={24} /></span>
              )
            }
            label={t("pass.details.icons", { count: totals.profileIcons })}
          />
        )}
      </div>
    </div>
  );
}

export default function PassTrackDetailsModal({ variant, tracks, onClose }: Props) {
  const { t } = useI18n();
  const titleKey = variant === "pro" ? "proPass.details.title" : "pass.details.title";
  const cols = tracks.length;

  useEffect(() => {
    void preloadPassDetailsChestModelsFromTracks(tracks);
  }, [tracks]);

  return createPortal(
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999990,
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
          width: cols >= 3 ? "min(860px, 96vw)" : "min(620px, 92vw)",
          position: "relative",
          borderRadius: 16,
          boxShadow: "0 20px 56px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <img
            src={BG[variant]}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.38)",
            }}
          />
        </div>

        <div style={{ position: "relative", zIndex: 1, padding: "14px 16px 16px", overflow: "visible" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.05em",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
              }}
            >
              {t(titleKey)}
            </div>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.75)",
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 26,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: cols >= 3 ? 14 : 20,
              alignItems: "start",
              overflow: "visible",
            }}
          >
            {tracks.map((track) => (
              <TrackColumn key={track.trackKey} {...track} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    getAppPortalRoot(),
  );
}
