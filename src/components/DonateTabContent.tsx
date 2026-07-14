import { useState } from "react";
import { useI18n } from "../i18n";
import {
  GEM_PACKS, GEM_TO_COIN_PACKS, GEM_TO_POWER_PACKS,
  RUB_TO_POWER_PACKS, RUB_TO_COIN_PACKS,
  isFirstGemPackAvailable, previewGemPack,
  buyGemPack, buyCoinsForGems, buyPowerForGems,
  buyPowerForRub, buyCoinsForRub,
  type GemPack,
} from "../utils/donateShop";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import RewardDropModal, { type RewardInfo } from "./RewardDropModal";
import { shopBtnLabel, shopLabelOnFill } from "./shop/shopButtonStyles";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props { onPurchased: () => void }

export default function DonateTabContent({ onPurchased }: Props) {
  const { t } = useI18n();
  const [reward, setReward] = useState<RewardInfo | null>(null);
  const [err, setErr] = useState("");

  const showErr = (e: string) => {
    setErr(e);
    setTimeout(() => setErr(""), 2500);
  };

  const firstAvail = isFirstGemPackAvailable();

  const handleGemPack = (pack: GemPack) => {
    const r = buyGemPack(pack.id);
    if (!r.success) { showErr(r.error || t("common.error")); return; }
    onPurchased();
    setReward({
      type: "gems",
      amount: r.gemsAdded || 0,
      label: r.doubled
        ? t("donate.reward.gemsDouble", { count: r.gemsAdded || 0 })
        : t("donate.reward.gems", { count: r.gemsAdded || 0 }),
    });
  };

  const handleCoinsForGems = (id: string, coins: number) => {
    const r = buyCoinsForGems(id);
    if (!r.success) { showErr(r.error || t("common.error")); return; }
    onPurchased();
    setReward({ type: "coins", amount: coins, label: t("donate.reward.coins", { count: coins }) });
  };

  const handlePowerForGems = (id: string, pp: number) => {
    const r = buyPowerForGems(id);
    if (!r.success) { showErr(r.error || t("common.error")); return; }
    onPurchased();
    setReward({ type: "powerPoints", amount: pp, label: t("donate.reward.power", { count: pp }) });
  };

  const handlePowerForRub = (id: string, pp: number) => {
    const r = buyPowerForRub(id);
    if (!r.success) { showErr(r.error || t("common.error")); return; }
    onPurchased();
    setReward({ type: "powerPoints", amount: pp, label: t("donate.reward.power", { count: pp }) });
  };

  const handleCoinsForRub = (id: string, coins: number) => {
    const r = buyCoinsForRub(id);
    if (!r.success) { showErr(r.error || t("common.error")); return; }
    onPurchased();
    setReward({ type: "coins", amount: coins, label: t("donate.reward.coins", { count: coins }) });
  };

  return (
    <div>
      {/* ── ₽ → 💎 GEM PACKS ── */}
      <SectionTitle
        accent="#40C4FF"
        title={t("donate.gems.title")}
        subtitle={firstAvail ? t("donate.gems.firstPurchaseHint") : t("donate.gems.subtitle")}
      />
      <Grid min={210}>
        {GEM_PACKS.map(pack => {
          const { totalGems, doubled } = previewGemPack(pack);
          const totalNoDouble = pack.gems + pack.bonusGems;
          return (
            <Card key={pack.id} accent="#40C4FF" highlight={pack.highlight}>
              {pack.highlight === "popular" && <Tag color="#FF8A00" text={t("donate.tag.popular")} />}
              {pack.highlight === "best"    && <Tag color="#E91E63" text={t("donate.tag.best")} />}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <GemIcon size={48} />
              </div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#40C4FF", textAlign: "center" }}>
                {totalGems}
                {doubled && (
                  <span style={{ fontSize: 12, marginLeft: 6, color: "#FFD740", fontWeight: 800 }}>
                    ×2
                  </span>
                )}
              </div>
              {pack.bonusGems > 0 && !doubled && (
                <div style={{ fontSize: 11, color: "#69F0AE", textAlign: "center", marginTop: 2, fontWeight: 700 }}>
                  <Tr id="donate.bonusGems" params={{ count: pack.bonusGems }} />
                </div>
              )}
              {doubled && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 2 }}>
                  <Tr id="donate.usually" params={{ count: totalNoDouble }} />
                </div>
              )}
              <button
                onClick={() => handleGemPack(pack)}
                style={primaryBtn("#40C4FF", "#0288D1")}
              >
                {pack.priceRub} ₽
              </button>
            </Card>
          );
        })}
      </Grid>

      {/* ── 💎 → 🪙 COINS ── */}
      <SectionTitle
        accent="#FFD740"
        title={t("donate.exchange.coinsTitle")}
        subtitle={t("donate.exchange.coinsSubtitle")}
      />
      <Grid min={170}>
        {GEM_TO_COIN_PACKS.map(p => (
          <Card key={p.id} accent="#FFD740">
            {p.bonusPct > 0 && <Tag color="#69F0AE" text={`+${p.bonusPct}%`} />}
            <Row><CoinIcon size={36} /></Row>
            <CenterText size={20} weight={900} color="#FFD740">{p.coins}</CenterText>
            <CenterText size={11} color="rgba(255,255,255,0.6)"><Tr id="donate.unit.coins" /></CenterText>
            <button
              onClick={() => handleCoinsForGems(p.id, p.coins)}
              style={primaryBtn("#FFD740", "#FFA000")}
            >
              <GemIcon size={14} /> {p.gems}
            </button>
          </Card>
        ))}
      </Grid>

      {/* ── 💎 → ⚡ POWER POINTS ── */}
      <SectionTitle
        accent="#CE93D8"
        title={t("donate.exchange.powerTitle")}
        subtitle={t("donate.exchange.powerSubtitle")}
      />
      <Grid min={170}>
        {GEM_TO_POWER_PACKS.map(p => (
          <Card key={p.id} accent="#CE93D8">
            {p.bonusPct > 0 && <Tag color="#69F0AE" text={`+${p.bonusPct}%`} />}
            <Row><PowerIcon size={36} /></Row>
            <CenterText size={20} weight={900} color="#CE93D8">{p.powerPoints}</CenterText>
            <CenterText size={11} color="rgba(255,255,255,0.6)"><Tr id="donate.unit.power" /></CenterText>
            <button
              onClick={() => handlePowerForGems(p.id, p.powerPoints)}
              style={primaryBtn("#CE93D8", "#7B1FA2")}
            >
              <GemIcon size={14} /> {p.gems}
            </button>
          </Card>
        ))}
      </Grid>

      {/* ── ₽ → ⚡ POWER POINTS ── */}
      <SectionTitle
        accent="#CE93D8"
        title={t("donate.rubPower.title")}
        subtitle={t("donate.rubPower.subtitle")}
      />
      <Grid min={170}>
        {RUB_TO_POWER_PACKS.map(p => (
          <Card key={p.id} accent="#CE93D8">
            <Row><PowerIcon size={36} /></Row>
            <CenterText size={20} weight={900} color="#CE93D8">{p.powerPoints}</CenterText>
            <CenterText size={11} color="rgba(255,255,255,0.6)"><Tr id="donate.unit.power" /></CenterText>
            <button
              onClick={() => handlePowerForRub(p.id, p.powerPoints)}
              style={primaryBtn("#CE93D8", "#7B1FA2")}
            >
              {p.priceRub} ₽
            </button>
          </Card>
        ))}
      </Grid>

      {/* ── ₽ → 🪙 COINS ── */}
      <SectionTitle
        accent="#FFD740"
        title={t("donate.rubCoins.title")}
        subtitle={t("donate.rubCoins.subtitle")}
      />
      <Grid min={170}>
        {RUB_TO_COIN_PACKS.map(p => (
          <Card key={p.id} accent="#FFD740">
            <Row><CoinIcon size={36} /></Row>
            <CenterText size={20} weight={900} color="#FFD740">{p.coins}</CenterText>
            <CenterText size={11} color="rgba(255,255,255,0.6)"><Tr id="donate.unit.coins" /></CenterText>
            <button
              onClick={() => handleCoinsForRub(p.id, p.coins)}
              style={primaryBtn("#FFD740", "#FFA000")}
            >
              {p.priceRub} ₽
            </button>
          </Card>
        ))}
      </Grid>

      {/* Disclaimer */}
      <div style={{
        marginTop: 18, padding: 14, fontSize: 11, lineHeight: 1.6,
        background: "rgba(0,0,0,0.3)", borderRadius: 12,
        color: "rgba(255,255,255,0.55)", textAlign: "center",
      }}>
        <Tr id="donate.disclaimer" />
      </div>

      {err && (
        <div style={{
          marginTop: 14, padding: 12, textAlign: "center",
          background: "rgba(255,82,82,0.15)", border: "1px solid rgba(255,82,82,0.4)",
          borderRadius: 10, color: "#FF8A65", fontWeight: 700,
        }}>{err}</div>
      )}

      {reward && (
        <RewardDropModal reward={reward} onDone={() => setReward(null)} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Layout helpers
// ──────────────────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle, accent }: { title: string; subtitle?: string; accent: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10, paddingLeft: 4 }}>
      <div style={{
        fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: accent,
      }}>{title.toUpperCase()}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Grid({ min, children }: { min: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
      gap: 12,
    }}>
      {children}
    </div>
  );
}

function Card({ accent, highlight, children }: {
  accent: string; highlight?: "popular" | "best"; children: React.ReactNode;
}) {
  const glow = highlight ? `0 0 18px ${accent}77, 0 0 4px ${accent}` : `0 4px 14px rgba(0,0,0,0.3)`;
  return (
    <div style={{
      position: "relative",
      background: `linear-gradient(180deg, ${accent}1A 0%, rgba(0,0,0,0.55) 100%)`,
      border: `1.5px solid ${accent}66`,
      borderRadius: 14, padding: 12,
      display: "flex", flexDirection: "column", alignItems: "center",
      boxShadow: glow,
    }}>
      {children}
    </div>
  );
}

function Tag({ color, text }: { color: string; text: string }) {
  return (
    <div style={{
      position: "absolute", top: -8, right: 8,
      background: color, color: "white",
      fontSize: 9, fontWeight: 900, letterSpacing: 1,
      borderRadius: 6, padding: "3px 8px",
      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      boxShadow: `0 2px 6px ${color}55`,
    }}>{text}</div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>{children}</div>;
}

function CenterText({ size, color, weight, children }: {
  size: number; color: string; weight?: number; children: React.ReactNode;
}) {
  return (
    <div style={{
      textAlign: "center", fontSize: size, color, fontWeight: weight || 700, marginTop: 2,
    }}>{children}</div>
  );
}

function primaryBtn(c1: string, c2: string): React.CSSProperties {
  const fill = `linear-gradient(135deg, ${c2}, ${c1})`;
  return shopBtnLabel(fill, shopLabelOnFill(c1), {
    marginTop: 10,
    width: "100%",
    borderRadius: 8,
    padding: "8px 0",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 1,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  });
}
