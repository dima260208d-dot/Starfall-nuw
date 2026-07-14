import { PORTRAIT_BG_GEM_COST, SHOP_PORTRAIT_BACKGROUNDS } from "../../data/portraitBackgrounds";
import { PORTRAIT_FRAME_ASPECT } from "../../data/portraitFrameDimensions";
import {
  getPortraitBackgroundThumbSrc,
  isPortraitBackgroundUnlocked,
} from "../../utils/portraitBackgroundUtils";
import type { UserProfile } from "../../utils/localStorageAPI";
import { GemIcon } from "../GameIcons";
import { TabHeader, EmptyState } from "./ShopTabParts";
import { shopBtnLabel } from "./shopButtonStyles";
import { useI18n } from "../../i18n";

export default function PortraitBackgroundsShopTab({
  profile,
  onBuy,
}: {
  profile: UserProfile;
  onBuy: (backgroundId: string) => void;
}) {
  const { t } = useI18n();
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const locked = SHOP_PORTRAIT_BACKGROUNDS.filter(b => !isPortraitBackgroundUnlocked(profile, b.id));

  if (!locked.length) {
    return (
      <EmptyState
        title={t("shop.portraitBg.emptyTitle")}
        subtitle={t("shop.portraitBg.emptySubtitle")}
      />
    );
  }

  return (
    <>
      <TabHeader
        title={t("shop.portraitBg.header")}
        subtitle={t("shop.portraitBg.subtitle", { cost: PORTRAIT_BG_GEM_COST })}
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: 10,
      }}>
        {locked.map(bg => {
          const canBuy = profile.gems >= PORTRAIT_BG_GEM_COST;
          return (
            <div
              key={bg.id}
              className="ui-glass"
              style={{
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                borderRadius: 14,
                border: "1px solid rgba(206,147,216,0.35)",
                contentVisibility: "auto",
                containIntrinsicSize: "140px",
              }}
            >
              <img
                src={getPortraitBackgroundThumbSrc(bg.id, base)}
                alt=""
                loading="lazy"
                decoding="async"
                width={88}
                height={Math.round(88 * 1.02)}
                style={{
                  width: "100%",
                  aspectRatio: PORTRAIT_FRAME_ASPECT,
                  objectFit: "fill",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              />
              <button
                type="button"
                onClick={() => onBuy(bg.id)}
                disabled={!canBuy}
                style={shopBtnLabel(
                  canBuy ? "linear-gradient(135deg, #7E57C2, #4527A0)" : "rgba(255,255,255,0.08)",
                  canBuy ? "#ffffff" : "rgba(255,255,255,0.55)",
                  {
                    width: "100%",
                    padding: "5px 12px",
                    fontWeight: 900,
                    fontSize: 11,
                    borderRadius: 8,
                    cursor: canBuy ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  },
                )}
              >
                <GemIcon size={11} /> {PORTRAIT_BG_GEM_COST}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
