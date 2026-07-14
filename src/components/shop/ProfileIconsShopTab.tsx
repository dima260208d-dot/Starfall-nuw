import { PROFILE_ICON_GEM_COST, SHOP_MISC_ICONS } from "../../data/profileIcons";
import { getProfileIconShopThumb, isProfileIconUnlocked } from "../../utils/profileIconUtils";
import type { UserProfile } from "../../utils/localStorageAPI";
import { GemIcon } from "../GameIcons";
import { TabHeader, EmptyState } from "./ShopTabParts";
import { shopBtnLabel } from "./shopButtonStyles";
import { useI18n } from "../../i18n";

export default function ProfileIconsShopTab({
  profile,
  onBuy,
}: {
  profile: UserProfile;
  onBuy: (iconId: string) => void;
}) {
  const { t } = useI18n();
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const locked = SHOP_MISC_ICONS.filter(i => !isProfileIconUnlocked(profile, i.id));
  if (!locked.length) {
    return <EmptyState title={t("shop.icons.emptyTitle")} subtitle={t("shop.icons.emptySubtitle")} />;
  }
  return (
    <>
      <TabHeader
        title={t("shop.icons.header")}
        subtitle={t("shop.icons.subtitle", { cost: PROFILE_ICON_GEM_COST })}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 10 }}>
        {locked.map(icon => {
          const canBuy = profile.gems >= PROFILE_ICON_GEM_COST;
          return (
            <div key={icon.id} className="ui-glass" style={{
              padding: "10px 6px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6, borderRadius: 14,
              border: "1px solid rgba(206,147,216,0.35)",
              contentVisibility: "auto", containIntrinsicSize: "120px",
            }}>
              <img
                src={getProfileIconShopThumb(icon.id, base)}
                alt=""
                loading="lazy"
                decoding="async"
                width={72}
                height={72}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10 }}
              />
              <button
                type="button"
                onClick={() => onBuy(icon.id)}
                disabled={!canBuy}
                style={shopBtnLabel(
                  canBuy ? "linear-gradient(135deg, #7E57C2, #4527A0)" : "rgba(255,255,255,0.08)",
                  canBuy ? "#ffffff" : "rgba(255,255,255,0.55)",
                  {
                    width: "100%", padding: "5px 12px", fontWeight: 900, fontSize: 11,
                    borderRadius: 8, cursor: canBuy ? "pointer" : "not-allowed",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  },
                )}
              >
                <GemIcon size={11} /> {PROFILE_ICON_GEM_COST}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
