import { useEffect, useMemo, useRef, useState } from "react";
import {
  getTodaysDeals, getMsUntilDealsReset, isDealBought, purchaseDeal,
  type ActiveDeal, type DealItem,
} from "../utils/dailyDeals";
import { getCurrentProfile, grantClashPassXp } from "../utils/localStorageAPI";
import { formatGameDayCountdown } from "../utils/gameDay";
import {
  bumpDealsPreviewIfNeeded,
  isDealUnseen,
  NEW_DEALS_PASS_XP,
  revealDeal,
} from "../utils/dailyDealsSeen";
import { CHESTS } from "../utils/chests";
import { PETS } from "../entities/PetData";
import { getCollectiblePin } from "../entities/CollectiblePinData";
import { getProfileIconImage } from "../utils/profileIconUtils";
import PinIcon from "./PinIcon";
import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import PetSvg from "./PetSvg";
import Chest3DViewer from "./Chest3DViewer";
import PassXpFlyBurst from "./PassXpFlyBurst";
import { shopBtnLabel } from "./shop/shopButtonStyles";
import { useI18n, getDealDisplayTitle } from "../i18n";
import { EmojiIcon, TextWithEmojis } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onPurchased?: () => void;
  passXpTargetRef?: React.RefObject<HTMLElement | null>;
}

export default function DailyDealsSection({ onPurchased, passXpTargetRef }: Props) {
  const { t } = useI18n();
  const [deals, setDeals] = useState<ActiveDeal[]>(() => {
    bumpDealsPreviewIfNeeded();
    return getTodaysDeals();
  });
  const [, force] = useState(0);
  const [resetMs, setResetMs] = useState(getMsUntilDealsReset());
  const [msg, setMsg] = useState("");
  const [passFlyJobs, setPassFlyJobs] = useState<Array<{ id: number; count: number; dealId: string }>>([]);
  const passFlyIdRef = useRef(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const t = setInterval(() => {
      const next = getMsUntilDealsReset();
      setResetMs(next);
      if (next <= 0) {
        setDeals(getTodaysDeals());
        force(x => x + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const profile = getCurrentProfile();

  const handleRevealDeal = (instanceId: string) => {
    const firstReveal = revealDeal(instanceId);
    if (firstReveal) {
      grantClashPassXp(NEW_DEALS_PASS_XP);
      const id = passFlyIdRef.current++;
      setPassFlyJobs(jobs => [...jobs, { id, count: NEW_DEALS_PASS_XP, dealId: instanceId }]);
    }
    force(x => x + 1);
  };

  const handleBuy = (deal: ActiveDeal) => {
    const r = purchaseDeal(deal);
    if (r.success) {
      setMsg(t("common.purchased"));
      onPurchased?.();
      force(x => x + 1);
    } else {
      setMsg(r.error || t("common.error"));
    }
    setTimeout(() => setMsg(""), 2200);
  };

  const cards = useMemo(() => deals, [deals]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10, paddingLeft: 4,
      }}>
        <div style={{ fontSize: 11, color: "#FFD54F", letterSpacing: 3, fontWeight: 800 }}>
          <Tr id="deals.sectionTitle" />
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.65)",
          letterSpacing: 1.5,
        }}>
          <Tr id="deals.resetsIn" params={{ time: formatGameDayCountdown(resetMs) }} />
        </div>
      </div>
      {msg && (
        <div style={{
          marginBottom: 8, padding: "6px 12px",
          background: "rgba(255,213,79,0.12)",
          border: "1px solid rgba(255,213,79,0.3)",
          borderRadius: 8,
          fontSize: 12, color: "#FFD54F", fontWeight: 700, textAlign: "center",
        }}>{msg}</div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))",
        gap: 12,
      }}>
        {cards.map(deal => (
          <DealCard
            key={deal.instanceId}
            deal={deal}
            bought={isDealBought(deal.instanceId)}
            showNew={isDealUnseen(deal.instanceId)}
            resetMs={resetMs}
            canAfford={profile != null && (
              deal.priceCurrency === "rub"
                ? true
                : deal.priceCurrency === "coins"
                  ? profile.coins >= deal.priceAmount
                  : profile.gems >= deal.priceAmount
            )}
            cardRef={el => { cardRefs.current[deal.instanceId] = el; }}
            onNew={() => handleRevealDeal(deal.instanceId)}
            onBuy={() => handleBuy(deal)}
          />
        ))}
      </div>
      {passFlyJobs.map(job => (
        <PassXpFlyBurst
          key={job.id}
          count={job.count}
          fromEl={cardRefs.current[job.dealId] ?? null}
          toEl={passXpTargetRef?.current ?? null}
          onComplete={() => setPassFlyJobs(jobs => jobs.filter(j => j.id !== job.id))}
        />
      ))}
    </div>
  );
}

function DealCard({
  deal, bought, canAfford, showNew, resetMs, onBuy, onNew, cardRef,
}: {
  deal: ActiveDeal;
  bought: boolean;
  canAfford: boolean;
  showNew: boolean;
  resetMs: number;
  onBuy: () => void;
  onNew: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const { t } = useI18n();
  const accent = deal.iconColor || "#FFD54F";
  const struck = deal.baselineAmount && deal.baselineAmount > deal.priceAmount;
  const discountPct = struck
    ? Math.round((1 - deal.priceAmount / deal.baselineAmount!) * 100)
    : 0;

  return (
    <div
      ref={cardRef}
      style={{
        position: "relative",
        background: `linear-gradient(180deg, ${accent}26 0%, rgba(0,0,0,0.55) 100%)`,
        border: `1.5px solid ${accent}66`,
        borderRadius: 14, padding: "12px 12px 10px",
        display: "flex", flexDirection: "column", gap: 8,
        boxShadow: `0 0 14px ${accent}33`,
        opacity: bought ? 0.5 : 1,
        filter: bought ? "grayscale(0.5)" : "none",
        overflow: "hidden",
      }}
    >
      <div style={{
        textAlign: "center",
        fontSize: 10,
        fontWeight: 800,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: 1,
      }}>
        <Tr id="dailyDeals.timeLeft" /> <span style={{ color: "#FFD54F" }}>{formatGameDayCountdown(resetMs)}</span>
      </div>

      {showNew && !bought ? (
        <button
          type="button"
          className="no-ui-shear"
          onClick={onNew}
          style={{
            flex: 1,
            minHeight: 200,
            margin: 0,
            padding: 0,
            border: "none",
            borderRadius: 10,
            background: "linear-gradient(155deg, rgba(255,244,117,0.96) 0%, rgba(255,213,0,0.98) 45%, rgba(255,193,7,0.96) 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            animation: "newMapPulse 2.2s ease-in-out infinite",
          }}
        >
          <span style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 4,
            color: "#fff",
            textShadow: "0 2px 10px rgba(255,152,0,0.85), 0 0 20px rgba(255,255,255,0.5)",
          }}>
            <Tr id="common.new" />
          </span>
          <span style={{ fontSize: 20, lineHeight: 1 }}><EmojiIcon emoji="✨✨✨" size={24} /></span>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 1px 6px rgba(255,120,0,0.7)",
          }}>
            +{NEW_DEALS_PASS_XP} XP Star Pass
          </span>
        </button>
      ) : (
        <>
          {discountPct > 0 && (
            <div style={{
              position: "absolute", top: 28, right: 8,
              background: "#FF1744", color: "white",
              fontSize: 10, fontWeight: 900, letterSpacing: 1,
              borderRadius: 6, padding: "2px 6px",
              boxShadow: "0 2px 6px rgba(255,23,68,0.5)",
            }}>−{discountPct}%</div>
          )}
          {deal.special && (
            <div style={{
              position: "absolute", top: 28, left: 8,
              background: "linear-gradient(135deg, #FFD700, #FF7043)",
              color: "white",
              fontSize: 9, fontWeight: 900, letterSpacing: 1,
              borderRadius: 6, padding: "2px 6px",
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}><TextWithEmojis text="★ HOT" emojiSize={24} /></div>
          )}

          <div style={{
            fontSize: 13, fontWeight: 900, color: accent,
            textAlign: "center", marginTop: 16,
            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
          }}>{getDealDisplayTitle(deal)}</div>

          <div style={{
            display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
            alignItems: "center",
            minHeight: 88, padding: "8px 0",
          }}>
            {deal.items.map((it, i) => (
              <DealItemBadge key={i} item={it} />
            ))}
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontSize: 14, fontWeight: 900, color: "white",
            background: "rgba(0,0,0,0.35)", borderRadius: 10, padding: "6px 0",
          }}>
            {deal.priceCurrency === "coins" ? (
              <CoinIcon size={14} />
            ) : deal.priceCurrency === "gems" ? (
              <GemIcon size={14} />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 900 }}>₽</span>
            )}
            <span>
              {deal.priceAmount}
              {deal.priceCurrency === "rub" ? " ₽" : ""}
            </span>
            {struck && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)",
                textDecoration: "line-through", marginLeft: 4,
              }}>{deal.baselineAmount}</span>
            )}
          </div>

          <button
            type="button"
            onClick={onBuy}
            disabled={bought || !canAfford}
            style={shopBtnLabel(
              bought
                ? "rgba(255,255,255,0.06)"
                : canAfford
                  ? `linear-gradient(135deg, ${accent}, ${accent}dd)`
                  : "rgba(255,255,255,0.05)",
              bought ? "rgba(255,255,255,0.55)" : canAfford ? "#ffffff" : "rgba(255,255,255,0.5)",
              {
                borderRadius: 10,
                padding: "8px 0",
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: 1.5,
                cursor: bought || !canAfford ? "default" : "pointer",
                boxShadow: bought ? "none" : `0 3px 10px ${accent}55`,
              },
            )}
          >
            {bought ? t("common.bought") : canAfford ? t("common.buy") : t("common.insufficient")}
          </button>
        </>
      )}
    </div>
  );
}

function DealItemBadge({ item }: { item: DealItem }) {
  const amountStyle = {
    display: "inline-flex" as const,
    alignItems: "center",
    gap: 5,
    fontSize: 17,
    fontWeight: 900,
    lineHeight: 1,
  };

  if (item.kind === "coins") {
    return (
      <span style={{ ...amountStyle, color: "#FFD700" }}>
        <CoinIcon size={22} /> {item.amount}
      </span>
    );
  }
  if (item.kind === "gems") {
    return (
      <span style={{ ...amountStyle, color: "#40C4FF" }}>
        <GemIcon size={22} /> {item.amount}
      </span>
    );
  }
  if (item.kind === "powerPoints") {
    return (
      <span style={{ ...amountStyle, color: "#CE93D8" }}>
        <PowerIcon size={22} /> {item.amount}
      </span>
    );
  }
  if (item.kind === "chest") {
    const def = CHESTS[item.rarity];
    const chestSize = 80;
    return (
      <div style={{ width: chestSize, height: chestSize, position: "relative" }}>
        <Chest3DViewer rarity={item.rarity} size={chestSize} />
        {item.count > 1 && (
          <span style={{
            position: "absolute", right: -2, bottom: -2,
            fontSize: 13, fontWeight: 900, color: def.color,
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          }}>×{item.count}</span>
        )}
      </div>
    );
  }
  if (item.kind === "pet") {
    const pet = PETS.find(p => p.id === item.petId);
    if (!pet) return null;
    return <PetSvg petId={pet.id} size={64} />;
  }
  if (item.kind === "pin") {
    const pin = getCollectiblePin(item.pinId);
    if (!pin) return null;
    return <PinIcon pinId={item.pinId} size={58} />;
  }
  if (item.kind === "profileIcon") {
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    return (
      <img
        src={getProfileIconImage(item.iconId, base)}
        alt=""
        style={{ width: 58, height: 58, borderRadius: 10, objectFit: "cover" }}
      />
    );
  }
  return null;
}
