import { useState } from "react";
import { getPendingGifts, claimGift, describeGiftItem, getGiftSenderTitle, type PendingGift } from "../utils/gifts";
import { CHESTS } from "../utils/chests";
import { PETS } from "../entities/PetData";
import { BRAWLERS } from "../entities/BrawlerData";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import PetSvg from "./PetSvg";
import RewardDropQueue from "./RewardDropQueue";
import BrawlerRevealModal from "./BrawlerRevealModal";
import PetRevealModal from "./PetRevealModal";
import { rewardInfosFromGiftItems } from "../utils/shopRewards";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onAllClaimed: () => void;
}

export default function GiftClaimModal({ onAllClaimed }: Props) {
  const { t } = useI18n();
  const [queue, setQueue] = useState<PendingGift[]>(() => getPendingGifts());
  const [busy, setBusy] = useState(false);
  const [rewardQueue, setRewardQueue] = useState<ReturnType<typeof rewardInfosFromGiftItems> | null>(null);
  const [revealBrawler, setRevealBrawler] = useState<string | null>(null);
  const [revealPet, setRevealPet] = useState<string | null>(null);
  const [claimedGift, setClaimedGift] = useState<PendingGift | null>(null);

  if (queue.length === 0 && !rewardQueue && !revealBrawler && !revealPet) return null;
  const gift = queue[0];

  const finishClaimUi = (remaining: PendingGift[]) => {
    setQueue(remaining);
    if (remaining.length === 0) onAllClaimed();
  };

  const startRewardAnimation = (g: PendingGift) => {
    const brawler = g.items.find(i => i.kind === "brawler");
    const pet = g.items.find(i => i.kind === "pet");
    if (brawler && brawler.kind === "brawler") {
      setRevealBrawler(brawler.brawlerId);
      return;
    }
    if (pet && pet.kind === "pet") {
      setRevealPet(pet.petId);
      return;
    }
    setRewardQueue(rewardInfosFromGiftItems(g.items));
  };

  const handleClaim = () => {
    if (busy || !gift) return;
    setBusy(true);
    const r = claimGift(gift.id);
    if (r.success && r.gift) {
      const remaining = getPendingGifts();
      setClaimedGift(r.gift);
      finishClaimUi(remaining);
      startRewardAnimation(r.gift);
    }
    setBusy(false);
  };

  const afterReveal = () => {
    if (revealBrawler) {
      setRevealBrawler(null);
      const pet = claimedGift?.items.find(i => i.kind === "pet");
      if (pet && pet.kind === "pet") {
        setRevealPet(pet.petId);
        return;
      }
    } else if (revealPet) {
      setRevealPet(null);
    }
    if (claimedGift) {
      const rest = claimedGift.items.filter(i => i.kind !== "brawler" && i.kind !== "pet");
      if (rest.length) setRewardQueue(rewardInfosFromGiftItems(rest));
    }
    setClaimedGift(null);
  };

  return (
    <>
      {gift && !rewardQueue && !revealBrawler && !revealPet && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(2,0,18,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 16,
          animation: "fadeIn 0.25s ease",
        }}>
          <div style={{
            width: "100%", maxWidth: 460,
            background: "linear-gradient(180deg, rgba(120,90,20,0.24) 0%, rgba(55,35,8,0.16) 100%)",
            border: "2px solid rgba(255,213,79,0.45)",
            borderRadius: 18, padding: 20,
            backdropFilter: "blur(10px) saturate(1.2)",
            WebkitBackdropFilter: "blur(10px) saturate(1.2)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35), 0 0 40px rgba(255,213,79,0.18), inset 0 1px 0 rgba(255,255,255,0.10)",
            animation: "popIn 0.4s cubic-bezier(.2,.9,.4,1.4)",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, fontSize: 44 }}><EmojiIcon emoji="🎁" size={24} /></div>
            <h2 style={{
              margin: 0, textAlign: "center",
              fontSize: 22, fontWeight: 900, color: "#FFD54F",
              letterSpacing: 1.5, textShadow: "0 0 14px rgba(255,213,79,0.55)",
            }}>{getGiftSenderTitle(gift).toUpperCase()}</h2>
            <div style={{
              marginTop: 4, textAlign: "center",
              fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1.2,
            }}>
              {new Date(gift.sentAt).toLocaleDateString()}
              {queue.length > 1 && t("gift.morePending", { count: queue.length - 1 })}
            </div>
            {gift.message && (
              <div style={{
                marginTop: 14, padding: "12px 14px",
                background: "rgba(255,213,79,0.08)",
                border: "1px solid rgba(255,213,79,0.25)",
                borderRadius: 10,
                fontSize: 13, color: "rgba(255,255,255,0.85)",
                fontStyle: "italic", lineHeight: 1.4, textAlign: "center",
              }}>«{gift.message}»</div>
            )}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {gift.items.map((it, i) => (
                <GiftItemRow key={i} item={it} />
              ))}
            </div>
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={handleClaim}
              disabled={busy}
              style={{
                marginTop: 20,
                width: "100%",
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "0.12em",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.65 : 1,
              }}
            ><Tr id="common.claim" /></button>
          </div>
        </div>
      )}
      {revealBrawler && <BrawlerRevealModal brawlerId={revealBrawler} onDone={afterReveal} />}
      {revealPet && <PetRevealModal petId={revealPet} onDone={afterReveal} />}
      {rewardQueue && rewardQueue.length > 0 && (
        <RewardDropQueue rewards={rewardQueue} onDone={() => setRewardQueue(null)} />
      )}
    </>
  );
}

function GiftItemRow({ item }: { item: ReturnType<typeof getPendingGifts>[number]["items"][number] }) {
  let icon: React.ReactNode = "🎁";
  let color = "#FFD54F";
  if (item.kind === "coins")        { icon = <CoinIcon size={22} />;  color = "#FFD700"; }
  else if (item.kind === "gems")    { icon = <GemIcon size={22} />;   color = "#40C4FF"; }
  else if (item.kind === "powerPoints") { icon = <PowerIcon size={22} />; color = "#CE93D8"; }
  else if (item.kind === "chest")   { icon = <span style={{ fontSize: 22 }}>{CHESTS[item.rarity].emoji}</span>; color = CHESTS[item.rarity].color; }
  else if (item.kind === "pet")     {
    const p = PETS.find(x => x.id === item.petId);
    if (p) {
      icon = <PetSvg pet={p} size={28} animated={false} haloPulse={false} />;
      color = p.color;
    }
  }
  else if (item.kind === "brawler") {
    const b = BRAWLERS.find(x => x.id === item.brawlerId);
    if (b) color = b.color;
    icon = <span style={{ fontSize: 22 }}><EmojiIcon emoji="🦸" size={24} /></span>;
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 12px",
      background: `${color}14`, border: `1px solid ${color}44`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}26`, borderRadius: 8,
      }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "white" }}>{describeGiftItem(item)}</div>
    </div>
  );
}
