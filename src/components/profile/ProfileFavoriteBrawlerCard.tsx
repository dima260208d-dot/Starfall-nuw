import { memo, useEffect, useRef, useState } from "react";
import type { MasteryTier } from "../../data/brawlerMastery";
import { getMasteryTitleText } from "../../data/brawlerMastery";
import BrawlerViewer3D from "../BrawlerViewer3D";
import { IntroMasteryBadge, IntroRankBadge, fitLabelFontSize } from "../battleIntro/IntroCardBadges";
import IntroNameBarIconSlots, { introNameBarIconColWidth } from "../battleIntro/IntroNameBarIconSlots";
import PortraitFrameBackdrop from "../PortraitFrameBackdrop";
import PinIcon from "../PinIcon";
import PlayerMasteryTitle from "../PlayerMasteryTitle";
import { getStarFeatBadgeUrl } from "../../utils/battleIntro/battleIntroParticipants";
import {
  INTRO_MODEL_HEIGHT_MULT,
  INTRO_PORTRAIT_HEIGHT_RATIO,
  PROFILE_NAME_BAR_HEIGHT_RATIO,
} from "../../utils/battleIntro/battleIntroSizing";
import type { IntroDisplayIconSlot } from "../../utils/introDisplayIcons";
import { useI18n } from "../../i18n";

export interface ProfileFavoriteBrawlerCardProps {
  brawlerId: string;
  brawlerColor: string;
  displayName: string;
  nameColor: string;
  pinId: string;
  masteryLevel: number;
  masteryTier: MasteryTier;
  featTierBadge: number;
  brawlerRank: number;
  masteryTitleId?: string;
  profileIconIds: [string, string];
  portraitBackgroundId?: string;
  readOnly?: boolean;
  onPickBrawler?: () => void;
  onPickPin?: () => void;
  onPickIntroIcon?: (slot: IntroDisplayIconSlot) => void;
}

function computeMetrics(cardW: number) {
  const modelH = Math.round(cardW * INTRO_PORTRAIT_HEIGHT_RATIO);
  const barH = Math.round(cardW * PROFILE_NAME_BAR_HEIGHT_RATIO);
  const uiScale = cardW / 108;
  return {
    cardW,
    modelH,
    barH,
    model3dSize: Math.round(modelH * INTRO_MODEL_HEIGHT_MULT * 0.8),
    uiScale,
  };
}

function ProfileFavoriteBrawlerCard({
  brawlerId,
  brawlerColor,
  displayName,
  nameColor,
  pinId,
  masteryLevel,
  masteryTier,
  featTierBadge,
  brawlerRank,
  masteryTitleId,
  profileIconIds,
  portraitBackgroundId,
  readOnly = false,
  onPickBrawler,
  onPickPin,
  onPickIntroIcon,
}: ProfileFavoriteBrawlerCardProps) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(236);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w >= 120) setCardW((prev) => (prev === Math.round(w) ? prev : Math.round(w)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { modelH, barH, model3dSize, uiScale } = computeMetrics(cardW);
  const scale = uiScale;
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const pinSize = Math.round(28 * scale);
  const badgeSize = Math.round(22 * scale);
  const featSize = Math.round(20 * scale);
  const rankSize = Math.round(24 * scale);
  const profileColW = introNameBarIconColWidth(scale, true, true);
  const nameFsBase = Math.max(9, Math.round(10 * scale));
  const titleFsBase = Math.max(5, Math.round(6 * scale));
  const textColW = Math.max(40, cardW - profileColW - Math.round(10 * scale));
  const nameFs = fitLabelFontSize(displayName, nameFsBase, textColW, 7);
  const masteryTitleText = masteryTitleId ? getMasteryTitleText(masteryTitleId) : "";
  const titleFs = masteryTitleText
    ? fitLabelFontSize(masteryTitleText, titleFsBase, textColW, 5)
    : titleFsBase;

  const frameBorder = "2px solid rgba(0,0,0,0.85)";
  const boxShadow = "0 4px 12px rgba(0,0,0,0.5)";

  return (
    <div ref={wrapRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ width: cardW, flexShrink: 0, transform: "scale(0.95)", transformOrigin: "top center" }}>
        <div
          style={{
            position: "relative",
            width: cardW,
            height: modelH,
            border: frameBorder,
            borderBottom: "none",
            boxShadow,
            overflow: "hidden",
          }}
        >
          <PortraitFrameBackdrop
            backgroundId={portraitBackgroundId ?? "pbg:001"}
            brawlerColor={brawlerColor}
            base={base}
          />
          {!readOnly && onPickBrawler && (
            <button
              type="button"
              className="no-ui-shear"
              onClick={onPickBrawler}
              title={t("profile.favoriteBrawler")}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                border: "none",
                padding: 0,
                margin: 0,
                background: "transparent",
                cursor: "pointer",
              }}
            />
          )}

          <div style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "6%",
            bottom: 0,
            zIndex: 1,
            overflow: "hidden",
            pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute",
              left: `calc(28% - ${model3dSize * 0.5}px)`,
              bottom: 0,
              transform: "translateX(-50%)",
            }}>
              <BrawlerViewer3D
                brawlerId={brawlerId}
                color={brawlerColor}
                size={model3dSize}
                showBackdrop={false}
                pixelRatioCap={2.5}
                efficientPreview={false}
                snapBackAfterDragMs={0}
              />
            </div>
          </div>

          <div style={{
            position: "absolute",
            top: 4,
            right: 3,
            zIndex: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            lineHeight: 0,
          }}>
            {readOnly ? (
              <PinIcon pinId={pinId} size={pinSize} bare animated={false} loading="eager" />
            ) : (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onPickPin?.(); }}
                title={t("profile.changeFavoritePin")}
                style={{
                  border: "none",
                  padding: 0,
                  margin: 0,
                  background: "transparent",
                  cursor: "pointer",
                  lineHeight: 0,
                }}
              >
                <PinIcon pinId={pinId} size={pinSize} bare animated={false} loading="eager" />
              </button>
            )}
            <IntroMasteryBadge level={masteryLevel} tier={masteryTier} size={badgeSize} />
            <img
              src={`${base}${getStarFeatBadgeUrl(featTierBadge)}`}
              alt=""
              loading="eager"
              decoding="async"
              style={{
                width: featSize,
                height: featSize,
                objectFit: "contain",
                flexShrink: 0,
                pointerEvents: "none",
              }}
            />
            <IntroRankBadge rank={brawlerRank} size={rankSize} />
          </div>
        </div>

        <div style={{
          width: cardW,
          height: barH,
          background: "rgba(0,0,0,0.92)",
          border: frameBorder,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "stretch",
          boxSizing: "border-box",
          boxShadow,
        }}>
          <div style={{
            flex: 1,
            minWidth: 0,
            padding: `${Math.round(2 * scale)}px ${Math.round(5 * scale)}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}>
            <div style={{
              fontSize: nameFs,
              fontWeight: 900,
              color: nameColor,
              whiteSpace: "nowrap",
              lineHeight: 1.05,
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            }}>
              {displayName}
            </div>
            {masteryTitleId && (
              <div style={{
                marginTop: 1,
                minHeight: Math.round(titleFs * 1.1),
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
              }}>
                <PlayerMasteryTitle
                  titleId={masteryTitleId}
                  fontSize={titleFs}
                  style={{
                    textAlign: "left",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                />
              </div>
            )}
          </div>
          <div style={{
            width: profileColW,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderLeft: "1px solid rgba(255,255,255,0.12)",
            padding: `${Math.round(1 * scale)}px ${Math.round(2 * scale)}px`,
          }}>
            <IntroNameBarIconSlots
              iconIds={profileIconIds}
              scale={scale}
              base={base}
              compact
              singleIcon
              editable={!readOnly && !!onPickIntroIcon}
              onEditSlot={onPickIntroIcon}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ProfileFavoriteBrawlerCard);
