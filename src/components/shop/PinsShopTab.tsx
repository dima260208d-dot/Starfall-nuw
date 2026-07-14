import { useState, useEffect, useMemo } from "react";
import { getCurrentProfile, getOwnedPins } from "../../utils/localStorageAPI";
import PinIcon from "../PinIcon";
import { GemIcon } from "../GameIcons";
import { PIN_KIND_ORDER, UNIVERSAL_PINS, pinIdFor, pinCostGems } from "../../entities/PinData";
import { COLLECTIBLE_PINS, COLLECTIBLE_PIN_RARITY_LABEL, type CollectiblePinRarity } from "../../entities/CollectiblePinData";
import { isPassExclusiveCollectiblePinDef } from "../../utils/passExclusiveCollectibles";
import { BRAWLERS } from "../../entities/BrawlerData";
import { TabHeader, SectionLabel } from "./ShopTabParts";
import { shopBtnLabel } from "./shopButtonStyles";
import { useI18n, brawlerName } from "../../i18n";
import { Tr } from "../../i18n/Tr";
import { EmojiIcon } from "../EmojiIcon";

export default function PinsShopTab({ profileGems, onBuy }: { profileGems: number; onBuy: (pinId: string) => void }) {
  const { t } = useI18n();
  const [profileTick, setProfileTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProfileTick(v => v + 1), 600);
    return () => clearInterval(t);
  }, []);
  const owned = useMemo(() => { void profileTick; return new Set(getOwnedPins()); }, [profileTick]);
  const unlocked = BRAWLERS.filter(b => getCurrentProfile()?.unlockedBrawlers.includes(b.id));
  const locked = BRAWLERS.filter(b => !unlocked.includes(b));

  return (
    <>
      <TabHeader title={t("shop.pins.header")} subtitle={t("shop.pins.subtitle")} />
      <div style={{ marginBottom: 22 }}>
        <SectionLabel color="#80DEEA" text={t("shop.pins.universal")} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
          {UNIVERSAL_PINS.map(u => (
            <div key={u.id} className="ui-glass" style={{ padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, borderRadius: 14 }}>
              <PinIcon pinId={u.id} size={62} />
              <div style={{ fontSize: 9, color: "#76FF03", fontWeight: 900 }}><Tr id="shop.pins.inStock" /></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <SectionLabel color="#CE93D8" text={t("shop.pins.collectible")} />
        {(["common", "rare", "epic", "unique", "golden"] as CollectiblePinRarity[]).map(rarity => {
          const forSale = COLLECTIBLE_PINS.filter(p => p.rarity === rarity && !owned.has(p.id) && !isPassExclusiveCollectiblePinDef(p));
          if (!forSale.length) return null;
          return (
            <div key={rarity} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#CE93D8", marginBottom: 8 }}>{COLLECTIBLE_PIN_RARITY_LABEL[rarity].toUpperCase()}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                {forSale.map(p => {
                  const cost = pinCostGems(p.id);
                  const canBuy = profileGems >= cost;
                  return (
                    <div key={p.id} className="ui-glass" style={{ padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, borderRadius: 14, contentVisibility: "auto", containIntrinsicSize: "130px" }}>
                      <PinIcon pinId={p.id} size={62} glow={canBuy} />
                      <button
                        type="button"
                        onClick={() => onBuy(p.id)}
                        disabled={!canBuy}
                        style={shopBtnLabel(
                          canBuy ? "linear-gradient(135deg, #7E57C2, #4527A0)" : "rgba(255,255,255,0.08)",
                          canBuy ? "#ffffff" : "rgba(255,255,255,0.55)",
                          {
                            borderRadius: 8, padding: "5px 10px", fontWeight: 900, fontSize: 11,
                            cursor: canBuy ? "pointer" : "not-allowed",
                            display: "inline-flex", alignItems: "center", gap: 4,
                          },
                        )}
                      >
                        <GemIcon size={11} /> {cost}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {[...unlocked, ...locked].map(b => {
        const isLocked = !unlocked.includes(b);
        const kindsForSale = PIN_KIND_ORDER.filter(kind => {
          const pinId = pinIdFor(b.id, kind);
          return !owned.has(pinId) && pinCostGems(pinId) > 0;
        });
        if (!kindsForSale.length) return null;
        return (
          <div key={b.id} style={{ marginBottom: 22, opacity: isLocked ? 0.55 : 1 }}>
            <SectionLabel color={b.color} text={<><EmojiIcon emoji="🎴" size={20} /> {brawlerName(b.id, b.name).toUpperCase()}{isLocked ? t("shop.pins.brawlerLockedSuffix") : ""}</>} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
              {kindsForSale.map(kind => {
                const pinId = pinIdFor(b.id, kind);
                const cost = pinCostGems(pinId);
                const canBuy = !isLocked && profileGems >= cost;
                return (
                  <div key={pinId} className="ui-glass" style={{ padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, borderRadius: 14 }}>
                    <PinIcon pinId={pinId} size={62} locked={isLocked} glow={canBuy} />
                    {isLocked ? (
                      <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.45)", textAlign: "center" }}><Tr id="char.unlockFirst" /></div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onBuy(pinId)}
                        disabled={!canBuy}
                        style={shopBtnLabel(
                          canBuy ? "linear-gradient(135deg, #7E57C2, #4527A0)" : "rgba(255,255,255,0.08)",
                          canBuy ? "#ffffff" : "rgba(255,255,255,0.55)",
                          {
                            borderRadius: 8, padding: "5px 10px", fontWeight: 900, fontSize: 11,
                            cursor: canBuy ? "pointer" : "not-allowed",
                            display: "inline-flex", alignItems: "center", gap: 4,
                          },
                        )}
                      >
                        <GemIcon size={11} /> {cost}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
