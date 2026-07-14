import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import AstralLlmSetupGuide, { type LlmGuideProvider } from "./AstralLlmSetupGuide";
import {
  isStarGuardianActive, getStarGuardianDaysRemaining,
  purchaseStarGuardian, STAR_GUARDIAN_PRICE_RUB,
  MAIN_DAILY_COINS, MAIN_DAILY_GEMS, MAIN_DAILY_POWER,
  SPECIAL_REWARD_INTERVAL_DAYS,
} from "../utils/subscription";
import StarGuardianIcon from "./StarGuardianIcon";
import { Tr } from "../i18n/Tr";
import { EmojiIcon, TextWithEmojis } from "./EmojiIcon";

interface Props {
  /** Called after a purchase succeeds so the parent can re-fetch profile state. */
  onPurchased?: () => void;
  /** Called when the user clicks open rewards on an active subscription. */
  onOpenRewards?: () => void;
}

export default function StarGuardianBuyCard({ onPurchased, onOpenRewards }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(isStarGuardianActive());
  const [days, setDays] = useState(getStarGuardianDaysRemaining());
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [llmGuide, setLlmGuide] = useState<LlmGuideProvider | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setActive(isStarGuardianActive());
      setDays(getStarGuardianDaysRemaining());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleBuy = () => {
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 4000); return; }
    setConfirming(false);
    purchaseStarGuardian();
    setActive(true);
    setDays(getStarGuardianDaysRemaining());
    setMsg(t("sg.purchasedMsg"));
    setTimeout(() => setMsg(""), 4000);
    onPurchased?.();
  };

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(160deg, rgba(255,215,64,0.18), rgba(74,20,140,0.4))",
      border: "2px solid #FFD740",
      borderRadius: 18,
      padding: 18,
      marginBottom: 24,
      boxShadow: "0 0 30px rgba(255,215,64,0.30)",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(circle at 80% 20%, rgba(255,215,64,0.2), transparent 60%)",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, position: "relative" }}>
        <StarGuardianIcon size={56} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 20, fontWeight: 900, color: "#FFD740",
            letterSpacing: 1, lineHeight: 1.1,
          }}>STAR GUARDIAN</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>
            <Tr id="sg.subtitle" />
          </div>
        </div>
        {active && (
          <div style={{
            background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
            color: "white", fontWeight: 800,
            borderRadius: 10, padding: "5px 10px",
            fontSize: 11, letterSpacing: 0.5,
          }}><Tr id="sg.activeBadge" params={{ days }} /></div>
        )}
      </div>

      <ul style={{
        listStyle: "none", padding: 0, margin: 0,
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 8, position: "relative",
      }}>
        <Bullet icon="🎁"><Tr id="sg.perkDaily" params={{ coins: MAIN_DAILY_COINS, gems: MAIN_DAILY_GEMS, power: MAIN_DAILY_POWER }} /></Bullet>
        <Bullet icon="🎯"><Tr id="sg.perkBonusPick" /></Bullet>
        <Bullet icon="⚡"><Tr id="sg.perkUpgradeToken" params={{ days: SPECIAL_REWARD_INTERVAL_DAYS }} /></Bullet>
        <Bullet icon="🤖"><Tr id="sg.perkAstral" /></Bullet>
        <Bullet icon="🧠"><Tr id="sg.perkCustomModel" /></Bullet>
        <Bullet icon="🎨"><Tr id="sg.perkNameColors" /></Bullet>
      </ul>

      <div style={{
        marginTop: 10, position: "relative",
        padding: "10px 12px", borderRadius: 12,
        background: "rgba(74,20,140,0.35)",
        border: "1px solid rgba(206,147,216,0.35)",
        fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,0.88)",
      }}>
        <Tr id="sg.aiModelHint" />
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", position: "relative" }}>
        <button
          type="button"
          onClick={() => setLlmGuide("openrouter")}
          style={{
            flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
            background: "rgba(126,87,194,0.45)", border: "1px solid rgba(206,147,216,0.5)",
            color: "#FFD740", fontWeight: 800, fontSize: 12,
          }}
        >
          <Tr id="sg.guideOpenRouter" />
        </button>
        <button
          type="button"
          onClick={() => setLlmGuide("openai")}
          style={{
            flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
            background: "rgba(126,87,194,0.45)", border: "1px solid rgba(206,147,216,0.5)",
            color: "#FFD740", fontWeight: 800, fontSize: 12,
          }}
        >
          <Tr id="sg.guideOpenAI" />
        </button>
      </div>

      <div style={{
        marginTop: 14, display: "flex", gap: 10, alignItems: "center",
        flexWrap: "wrap", position: "relative",
      }}>
        {active ? (
          <button type="button" className="no-ui-shear" onClick={onOpenRewards} style={{
            background: "linear-gradient(135deg, #FFE57F 0%, #FFD740 48%, #FF8A00 100%)",
            border: "1px solid rgba(255,255,255,0.45)", borderRadius: 12,
            padding: "10px 18px", fontWeight: 900,
            color: "#ffffff", cursor: "pointer", fontSize: 14,
            boxShadow: "0 6px 20px rgba(255,160,0,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
            textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
          }}><Tr id="sg.openRewards" /></button>
        ) : (
          <button type="button" className="no-ui-shear" onClick={handleBuy} style={{
            background: confirming
              ? "linear-gradient(135deg, #FF5252, #C62828)"
              : "linear-gradient(135deg, #FFE57F 0%, #FFD740 48%, #FF8A00 100%)",
            border: confirming ? "none" : "1px solid rgba(255,255,255,0.45)",
            borderRadius: 12,
            padding: "10px 18px", fontWeight: 900,
            color: "#ffffff", cursor: "pointer", fontSize: 14,
            boxShadow: confirming
              ? "0 6px 18px rgba(198,40,40,0.45)"
              : "0 6px 20px rgba(255,160,0,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
            textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
            transition: "all 200ms",
          }}>
            {confirming
              ? t("sg.confirmBuy", { price: STAR_GUARDIAN_PRICE_RUB })
              : t("sg.subscribe", { price: STAR_GUARDIAN_PRICE_RUB })}
          </button>
        )}
        {active && (
          <button type="button" className="no-ui-shear" onClick={handleBuy} style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,215,64,0.65)",
            borderRadius: 12, padding: "10px 14px", color: "#FFE57F",
            cursor: "pointer", fontSize: 12, fontWeight: 800,
            textShadow: "0 1px 2px rgba(0,0,0,0.55)",
          }}>
            {confirming
              ? t("sg.extendConfirm", { price: STAR_GUARDIAN_PRICE_RUB })
              : t("sg.extend")}
          </button>
        )}
        {msg && <span style={{ color: "#69F0AE", fontSize: 12, fontWeight: 600 }}><TextWithEmojis text={msg} emojiSize={21} /></span>}
      </div>

      {llmGuide && (
        <AstralLlmSetupGuide
          initialProvider={llmGuide}
          onClose={() => setLlmGuide(null)}
        />
      )}
    </div>
  );
}

function Bullet({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      background: "rgba(0,0,0,0.25)",
      borderRadius: 10, padding: "8px 10px",
      fontSize: 12, lineHeight: 1.4, color: "white",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}><EmojiIcon emoji={icon} size={24} /></span>
      <span>{children}</span>
    </li>
  );
}
