import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import {
  getCurrentProfile,
  buyChest,
  openChest,
} from "../utils/localStorageAPI";
import { CHESTS, CHEST_RARITY_ORDER, CHEST_CARD_TINT, type ChestRarity, type ChestRoll } from "../utils/chests";
import { getEffectiveChestPrices } from "../utils/characterBalance";
import { getEffectiveChestDrops, getEffectivePinDropChance, getEffectiveProfileIconDropChance, getEffectiveBrawlerRarityDropRows, getEffectiveChestBrawlerFloorPctLabel, getEffectivePetRarityDropRows, getEffectiveChestPetFloorPctLabel } from "../utils/chestBalance";
import {
  BRAWLER_RARITY_LABEL,
} from "../entities/BrawlerData";
import {
  getPetFloorTierLabel,
  petFloorTier,
  PET_RARITY_LABEL,
} from "../entities/PetData";
import Chest3DViewer from "../components/Chest3DViewer";
import ChestOpenAnimation from "../components/ChestOpenAnimation";
import ChestOpenModal from "../components/ChestOpenModal";
import { CoinIcon, GemIcon } from "../components/GameIcons";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { useI18n, chestName, chestDescription, brawlerRarityLabel, petRarityLabel } from "../i18n";
import { EmojiIcon, TextWithEmojis } from "../components/EmojiIcon";

interface Props {
  onBack: () => void;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

const CHEST_DISPLAY_MAX_TIER = CHEST_RARITY_ORDER.length;

function chestTierStars(tier: number): string {
  const filled = Math.min(Math.max(0, tier), CHEST_DISPLAY_MAX_TIER);
  const empty = Math.max(0, CHEST_DISPLAY_MAX_TIER - filled);
  return `${"★".repeat(filled)}${"☆".repeat(empty)}`;
}

/** Effective gem amounts shown in UI (÷3 at roll time). */
function chestGemRange(range: [number, number]): [number, number] {
  const lo = Math.max(1, Math.floor(range[0] / 3));
  const hi = Math.max(lo, Math.floor(range[1] / 3));
  return [lo, hi];
}

function chestBonusGems(amount: number): number {
  return Math.max(1, Math.floor(amount / 3));
}

const PET_ROW_COLOR: Record<string, string> = {
  common: CHESTS.common.color,
  rare: CHESTS.rare.color,
  epic: CHESTS.epic.color,
  mythic: CHESTS.mythic.color,
  legendary: CHESTS.legendary.color,
};

function InfoColumn({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      minWidth: 0, flex: "1 1 200px",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase",
        color: accent, paddingBottom: 6, borderBottom: `1px solid ${accent}44`,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function ChestInfoModal({ rarity, onClose }: { rarity: ChestRarity; onClose: () => void }) {
  const { t } = useI18n();
  const def = CHESTS[rarity];
  const d = getEffectiveChestDrops(rarity);
  const brawlerRarityRows = getEffectiveBrawlerRarityDropRows(rarity);
  const petRarityRows = getEffectivePetRarityDropRows(rarity);
  const brawlerFloorRarity = (rarity === "common" ? "rare" : rarity) as ChestRarity;
  const brawlerFloorLabel = brawlerRarityLabel(brawlerFloorRarity, BRAWLER_RARITY_LABEL[brawlerFloorRarity]);
  const petFloorRarity = petFloorTier(rarity);
  const petFloorLabel = petRarityLabel(petFloorRarity, PET_RARITY_LABEL[petFloorRarity]);
  const pinChance = getEffectivePinDropChance(rarity);
  const iconChance = getEffectiveProfileIconDropChance(rarity);

  const rollTotal = d.gemsChance + d.powerPointsChance;
  const coinsChance = Math.max(0, 1 - rollTotal);

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,5,0.88)",
        backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="ui-glass-strong"
        style={{
          background: `linear-gradient(160deg, ${def.color}33 0%, rgba(8,4,24,0.95) 100%)`,
          border: `1px solid ${def.borderColor}`,
          borderRadius: "var(--r-xl)",
          padding: "22px 24px",
          maxWidth: 920,
          width: "100%",
          maxHeight: "min(92vh, 720px)",
          overflowY: "auto",
          boxShadow: `0 0 60px ${def.color}66, var(--sh-lg), inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: def.color, letterSpacing: 2 }}>
            {chestName(rarity).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            <TextWithEmojis text={t("common.resourcesGuaranteed", { stars: chestTierStars(def.tier), rolls: String(d.rolls) })} emojiSize={18} />
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", marginTop: 6, lineHeight: 1.45 }}>
            {t("common.extraDrops", { rolls: String(d.rolls) })}
          </div>
        </div>

        <div style={{
          display: "flex", flexWrap: "wrap", gap: 14,
          alignItems: "flex-start",
        }}>
          <InfoColumn title={t("chest.info.brawlers")} accent={def.color}>
            <Row
              label={<><EmojiIcon emoji="🦸" size={21} /> {brawlerFloorLabel}</>}
              value={getEffectiveChestBrawlerFloorPctLabel(rarity)}
              color={def.color}
              highlight
            />
            {brawlerRarityRows.map(row => (
              <Row
                key={row.rarity}
                label={brawlerRarityLabel(row.rarity, row.label)}
                value={row.pctLabel}
                color={CHESTS[row.rarity].color}
                compact
              />
            ))}
          </InfoColumn>

          <InfoColumn title={t("chest.info.pets")} accent="#69F0AE">
            <Row
              label={<><EmojiIcon emoji="🐾" size={21} /> {petFloorLabel}</>}
              value={getEffectiveChestPetFloorPctLabel(rarity)}
              color="#69F0AE"
              highlight
            />
            {petRarityRows.map(row => (
              <Row
                key={row.rarity}
                label={petRarityLabel(row.rarity, row.label)}
                value={row.pctLabel}
                color={PET_ROW_COLOR[row.rarity] ?? "#69F0AE"}
                compact
              />
            ))}
          </InfoColumn>

          <InfoColumn title={t("chest.info.other")} accent="#CE93D8">
            <Row label={t("chest.row.sticker")} value={pct(pinChance)} color="#CE93D8" />
            <Row label={t("chest.row.icon")} value={pct(iconChance)} color="#B388FF" />
          </InfoColumn>

          <InfoColumn title={t("chest.info.resources", { rolls: String(d.rolls) })} accent="#40C4FF">
            <Row
              label={t("chest.row.gems")}
              value={`${pct(d.gemsChance)} (${chestGemRange(d.gemsRange)[0]}–${chestGemRange(d.gemsRange)[1]})`}
              color="#40C4FF"
            />
            <Row
              label={t("chest.row.power")}
              value={`${pct(d.powerPointsChance)} (${d.powerPointsRange[0]}–${d.powerPointsRange[1]})`}
              color="#CE93D8"
            />
            <Row
              label={t("chest.row.coins")}
              value={`~${pct(coinsChance)} (${d.coinsRange[0]}–${d.coinsRange[1]})`}
              color="#FFD700"
            />
          </InfoColumn>

          {(d.bonusGems || d.bonusPowerPoints || d.bonusCoins || d.xp) ? (
            <InfoColumn title={t("chest.info.bonuses")} accent="#FFD700">
              {d.bonusGems ? (
                <Row label={t("chest.row.gems")} value={`+${chestBonusGems(d.bonusGems)}`} color="#40C4FF" />
              ) : null}
              {d.bonusPowerPoints ? (
                <Row label={t("chest.row.power")} value={`+${d.bonusPowerPoints}`} color="#CE93D8" />
              ) : null}
              {d.bonusCoins ? (
                <Row label={t("chest.row.coins")} value={`+${d.bonusCoins}`} color="#FFD700" />
              ) : null}
              {d.xp ? (
                <Row label={t("pass.starpassXp")} value={`+${d.xp}`} color="#FFD700" />
              ) : null}
            </InfoColumn>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="ui-btn ui-btn--block ui-btn--lg"
          style={{
            marginTop: 24,
            background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
            border: `1px solid ${def.borderColor}`,
            color: "#fff",
            letterSpacing: "0.16em",
            boxShadow: `0 8px 22px ${def.color}66, inset 0 1px 0 rgba(255,255,255,0.32)`,
          }}
        >
          {t("common.closeUpper")}
        </button>
      </div>
    </div>
  );

  return createPortal(modal, getAppPortalRoot());
}

function Row({
  label, value, color, highlight, compact,
}: {
  label: ReactNode; value: string; color: string; highlight?: boolean; compact?: boolean;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
      background: highlight ? `${color}18` : "rgba(255,255,255,0.04)",
      borderRadius: 8, padding: compact ? "5px 8px" : "7px 12px",
      border: highlight ? `1px solid ${color}44` : "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: compact ? 11 : 13, color: "rgba(255,255,255,0.7)", flex: 1, minWidth: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: compact ? 11 : 13, fontWeight: 900, color, whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

export default function ChestsPage({ onBack }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState<string | null>(null);
  const [animating, setAnimating] = useState<{ rarity: ChestRarity; rolls: ChestRoll[] } | null>(null);
  const [opening, setOpening] = useState<{ rarity: ChestRarity; rolls: ChestRoll[] } | null>(null);
  const [infoRarity, setInfoRarity] = useState<ChestRarity | null>(null);

  useEffect(() => {
    const id = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;

  const handleBuy = (rarity: ChestRarity) => {
    const r = buyChest(rarity, "gems");
    setMsg(r.success ? t("common.chestPurchased", { name: chestName(rarity) }) : (r.error || t("common.error")));
    setProfile(getCurrentProfile());
    setTimeout(() => setMsg(null), 2000);
  };

  const handleOpen = (rarity: ChestRarity) => {
    void import("../audio/audioUnlock").then(({ noteUserGesture }) => noteUserGesture());
    const r = openChest(rarity);
    if (!r.success) {
      setMsg(r.error || t("common.error"));
      setTimeout(() => setMsg(null), 2000);
      return;
    }
    setProfile(getCurrentProfile());
    setAnimating({ rarity, rolls: r.rolls! });
  };

  const handleAnimationDone = () => {
    if (!animating) return;
    const data = { ...animating };
    setAnimating(null);
    setOpening(data);
  };

  const handleOpenModalClose = () => {
    setOpening(null);
  };

  return (
    <PageBg variant="chests" style={{ fontFamily: "var(--app-font-sans)" }}>
      <style>{`
        @keyframes chestSparkle {
          0%,100% { opacity: 0.25; transform: scale(0.8); }
          50%     { opacity: 0.85; transform: scale(1.18); }
        }
      `}</style>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 7919) % 100}%`,
            top: `${(i * 4091) % 100}%`,
            width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
            borderRadius: "50%",
            background: ["#FFD740", "#FFFFFF", "#FFE082"][i % 3],
            boxShadow: "0 0 8px rgba(255,213,79,0.65)",
            animation: `chestSparkle ${2 + (i % 4) * 0.7}s ease-in-out infinite`,
            animationDelay: `${(i % 5) * 0.4}s`,
          }} />
        ))}
      </div>
      <PageHeader
        onBack={onBack}
        title={t("chest.title")}
        coins={profile.coins}
        gems={profile.gems}
        power={profile.powerPoints}
      />

      <PageBody style={{ paddingBottom: 40 }}>
      {msg && (
        <div className="ui-glass ui-glow-gold" style={{
          maxWidth: 600, margin: "18px auto 14px",
          color: "#ffd54f",
          padding: "10px 16px",
          textAlign: "center", fontWeight: 700, fontSize: 14,
          letterSpacing: "0.04em",
        }}>{msg}</div>
      )}

      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "20px 18px 0",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {CHEST_RARITY_ORDER.map(rarity => {
          const def = CHESTS[rarity];
          const prices = getEffectiveChestPrices(rarity);
          const owned = profile.chestInventory[rarity] || 0;
          const canBuyGems = profile.gems >= prices.priceGems;
          const brawlerPctLabel = getEffectiveChestBrawlerFloorPctLabel(rarity);
          return (
            <div key={rarity} className="ui-card is-interactive" style={{
              background: CHEST_CARD_TINT[rarity],
              border: `1px solid ${def.borderColor}99`,
              borderRadius: "var(--r-xl)",
              padding: 16,
              display: "flex", flexDirection: "column", alignItems: "center",
              boxShadow: `0 0 32px ${def.color}40, var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.08)`,
              position: "relative",
              backdropFilter: "blur(12px) saturate(1.18)",
              WebkitBackdropFilter: "blur(12px) saturate(1.18)",
            }}>
              <button
                onClick={() => setInfoRarity(rarity)}
                title={t("common.dropRates")}
                style={{
                  position: "absolute", top: 10, right: 10,
                  width: 28, height: 28, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${def.color}55, ${def.color}22)`,
                  border: `1px solid ${def.color}`,
                  color: "#fff", fontWeight: 900, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                  boxShadow: `0 0 12px ${def.color}66`,
                  zIndex: 2,
                }}
              >?</button>

              {/* 3D Chest model replacing flat ChestVisual */}
              <div
                style={{
                  height: 220,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: owned > 0 ? "pointer" : "default",
                }}
                onClick={() => owned > 0 && handleOpen(rarity)}
                title={owned > 0 ? t("common.tapToOpen") : undefined}
              >
                <Chest3DViewer rarity={rarity} size={200} />
              </div>

              <div style={{
                fontSize: 17, fontWeight: 900, color: def.color, marginTop: 8,
                letterSpacing: 1, textAlign: "center",
              }}>
                {chestName(rarity)}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, textAlign: "center", minHeight: 30 }}>
                {chestDescription(rarity)}
              </div>
              <div style={{
                marginTop: 8, fontSize: 11, color: "var(--t-2)",
                background: "rgba(0,0,0,0.4)", border: `1px solid ${def.color}55`,
                borderRadius: "var(--r-pill)", padding: "5px 12px",
                display: "flex", gap: 10, alignItems: "center",
                backdropFilter: "blur(8px)",
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}>
                <span>{t("common.resourcesRolls", { rolls: String(def.drops.rolls), tier: String(def.tier) })}</span>
                <span style={{ color: def.color, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="🦸" size={21} /> {brawlerPctLabel}</span>
              </div>

              <div style={{ marginTop: 12, width: "100%" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 12, color: "var(--t-3)", marginBottom: 6,
                  letterSpacing: "0.02em",
                }}>
                  <span>{t("common.inventoryColon")}</span>
                  <span style={{ color: def.color, fontWeight: 900, fontSize: 14 }}>{owned}</span>
                </div>
                <button
                  onClick={() => handleOpen(rarity)}
                  disabled={owned < 1}
                  className={`ui-btn ui-btn--block ${owned > 0 ? "" : "ui-btn--ghost"}`}
                  style={{
                    padding: "10px 0",
                    fontSize: 13,
                    letterSpacing: "0.16em",
                    ...(owned > 0 ? {
                      background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
                      border: `1px solid ${def.borderColor}`,
                      color: "#fff",
                      boxShadow: `0 8px 20px ${def.color}66, inset 0 1px 0 rgba(255,255,255,0.32)`,
                    } : {}),
                  }}
                >
                  {t("common.open")}
                </button>
              </div>

              <button
                onClick={() => handleBuy(rarity)}
                disabled={!canBuyGems}
                className={`ui-btn ui-btn--block ${canBuyGems ? "ui-btn--cyan" : "ui-btn--ghost"}`}
                style={{ marginTop: 10, padding: "8px 0", fontSize: 12 }}
              >
                <GemIcon size={13} /> {t("common.buyForGems", { price: String(prices.priceGems) })}
              </button>
            </div>
          );
        })}
      </div>
      </PageBody>

      {/* 3D spin+glow animation before the drop reveal */}
      {animating && (
        <ChestOpenAnimation
          rarity={animating.rarity}
          onDone={handleAnimationDone}
        />
      )}

      {opening && (
        <ChestOpenModal
          rarity={opening.rarity}
          rolls={opening.rolls}
          onClose={handleOpenModalClose}
        />
      )}

      {infoRarity && (
        <ChestInfoModal rarity={infoRarity} onClose={() => setInfoRarity(null)} />
      )}
    </PageBg>
  );
}
