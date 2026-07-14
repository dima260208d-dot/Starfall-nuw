import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useI18n, brawlerName } from "../i18n";
import {
  getCurrentProfile,
  type UserProfile,
} from "../utils/localStorageAPI";
import {
  NEWCOMER_GIFT_CHAIN,
  NEWCOMER_GIFT_COUNT,
  canClaimNewcomerGift,
  claimNewcomerGift,
  ensureNewcomerGiftPreview,
  getNewcomerGiftBrawlerId,
  getNewcomerGiftsState,
  newcomerGiftLabelKey,
  newcomerGiftLabelParams,
  newcomerGiftTimeLeftMs,
  type NewcomerGiftDef,
} from "../utils/newcomerGifts";
import { getBrawlerById } from "../entities/BrawlerData";
import { pinIdFor } from "../entities/PinData";
import { formatHmsShort } from "../utils/quests";
import BrawlerViewer3D from "./BrawlerViewer3D";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import GlowingStar from "./GlowingStar";
import ModalCloseButton from "./ModalCloseButton";
import { type RewardInfo } from "./RewardDropModal";
import RewardDropQueue from "./RewardDropQueue";
import BrawlerRevealModal from "./BrawlerRevealModal";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onClose: () => void;
  onProfileChange?: () => void;
}

const PIN_KINDS_FOR_REWARD = ["happy", "sad", "thumbs_up", "angry"] as const;

const CARD_MIN_H = 180;
const BRAWLER_CARD_MIN_H = 200;
const BRAWLER_PREVIEW_PX = 112;

/** Стили панели как у окна ИИ Астрал (AstralChatModal). */
const ASTRAL_SHELL = {
  overlay: {
    background: "rgba(2,0,18,0.45)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  panel: {
    background:
      "linear-gradient(180deg, rgba(255,232,250,0.22) 0%, rgba(222,198,255,0.16) 48%, rgba(255,205,238,0.18) 100%)",
    border: "1px solid rgba(244,180,255,0.52)",
    borderRadius: 20,
    boxShadow:
      "0 18px 58px rgba(0,0,0,0.38), 0 0 34px rgba(244,143,255,0.22), inset 0 1px 0 rgba(255,255,255,0.28)",
    backdropFilter: "blur(12px) saturate(1.22)",
    WebkitBackdropFilter: "blur(12px) saturate(1.22)",
  },
  radial: {
    pointerEvents: "none" as const,
    position: "absolute" as const,
    inset: 0,
    borderRadius: 20,
    background:
      "radial-gradient(circle at 18% -8%, rgba(255,180,245,0.26), transparent 28%), radial-gradient(circle at 86% 106%, rgba(179,136,255,0.20), transparent 32%)",
  },
  header: {
    padding: "6px 16px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06)), linear-gradient(90deg, rgba(255,128,220,0.16), rgba(179,136,255,0.14), rgba(255,213,245,0.10))",
    borderBottom: "1px solid rgba(244,180,255,0.28)",
    boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.12)",
  },
  headerGlow: {
    position: "absolute" as const,
    left: 12,
    right: 12,
    top: 0,
    height: 2,
    background:
      "linear-gradient(90deg, transparent, rgba(255,128,220,0.85), rgba(179,136,255,0.85), transparent)",
  },
};

type CardState = "claimed" | "ready" | "wait" | "locked";

function cardStateFor(index: number, profile: UserProfile): CardState {
  const st = getNewcomerGiftsState(profile)!;
  if (index < st.claimedCount) return "claimed";
  if (index === st.claimedCount) {
    return canClaimNewcomerGift(profile) ? "ready" : "wait";
  }
  return "locked";
}

function cardBorder(state: CardState): string {
  if (state === "ready") return "1.5px solid #FFD740";
  if (state === "claimed") return "1.5px solid rgba(129,199,132,0.75)";
  return "1.5px solid rgba(206,147,216,0.42)";
}

function cardBackground(state: CardState): string {
  if (state === "ready") {
    return "linear-gradient(165deg, rgba(255,215,0,0.24), rgba(74,20,140,0.58), rgba(26,0,51,0.92))";
  }
  if (state === "claimed") {
    return "linear-gradient(165deg, rgba(129,199,132,0.20), rgba(74,20,140,0.52), rgba(26,0,51,0.94))";
  }
  return "linear-gradient(165deg, rgba(179,136,255,0.18), rgba(74,20,140,0.48), rgba(26,0,51,0.94))";
}

function GiftIconPreview({ gift, brawlerId, hero }: { gift: NewcomerGiftDef; brawlerId: string | null; hero?: boolean }) {
  const size = hero ? 52 : 44;
  switch (gift.kind) {
    case "coins":
    case "bundle_final":
      return <CoinIcon size={size} />;
    case "gems":
      return <GemIcon size={size} />;
    case "powerPoints":
      return <PowerIcon size={size} />;
    case "brawler_stars_2":
      return <GlowingStar size={size} filled />;
    case "brawler_pins_4":
      return <span style={{ fontSize: hero ? 42 : 36 }}><EmojiIcon emoji="📌" size={24} /></span>;
    case "brawler_level_7":
    case "brawler_level_11":
      return <PowerIcon size={size} />;
    case "brawler_unlock":
      if (!brawlerId) return <span style={{ fontSize: hero ? 48 : 40 }}><EmojiIcon emoji="🎁" size={24} /></span>;
      return (
        <BrawlerViewer3D
          brawlerId={brawlerId}
          color={getBrawlerById(brawlerId)?.color ?? "#CE93D8"}
          size={hero ? BRAWLER_PREVIEW_PX : 88}
          efficientPreview
          pixelRatioCap={1.35}
          showBackdrop
        />
      );
    default:
      return <span style={{ fontSize: hero ? 48 : 40 }}><EmojiIcon emoji="🎁" size={24} /></span>;
  }
}

export default function NewcomerGiftsModal({ onClose, onProfileChange }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(() => ensureNewcomerGiftPreview() ?? getCurrentProfile());
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [revealBrawler, setRevealBrawler] = useState<string | null>(null);
  const [pendingRewards, setPendingRewards] = useState<RewardInfo[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [profile?.newcomerGifts?.claimedCount]);

  if (!profile) return null;

  const st = getNewcomerGiftsState(profile);
  if (!st) return null;

  const brawlerId = getNewcomerGiftBrawlerId(profile);
  const canClaim = canClaimNewcomerGift(profile);
  const timeLeft = newcomerGiftTimeLeftMs(profile);
  const activeIndex = st.claimedCount;

  const refresh = () => {
    const next = getCurrentProfile();
    setProfile(next);
    onProfileChange?.();
  };

  const buildRewardInfos = (giftIndex: number): RewardInfo[] => {
    const gift = NEWCOMER_GIFT_CHAIN[giftIndex];
    if (!gift) return [];
    const label = t(newcomerGiftLabelKey(gift), newcomerGiftLabelParams(gift, profile));
    switch (gift.kind) {
      case "coins":
        return [{ type: "coins", amount: gift.coins ?? 0, label }];
      case "gems":
        return [{ type: "gems", amount: gift.gems ?? 0, label }];
      case "powerPoints":
        return [{ type: "powerPoints", amount: gift.powerPoints ?? 0, label }];
      case "brawler_level_7":
        return [{ type: "powerPoints", amount: 7, label }];
      case "brawler_level_11":
        return [{ type: "powerPoints", amount: 11, label }];
      case "brawler_stars_2":
        return [{ type: "xp", amount: 2, label }];
      case "brawler_pins_4": {
        if (!brawlerId) return [{ type: "xp", amount: 1, label }];
        return PIN_KINDS_FOR_REWARD.map(kind => ({
          type: "pin" as const,
          amount: 1,
          pinId: pinIdFor(brawlerId, kind),
          label,
        }));
      }
      case "bundle_final": {
        const out: RewardInfo[] = [];
        if (gift.coins) {
          out.push({
            type: "coins",
            amount: gift.coins,
            label: t("newcomerGifts.coins", { count: gift.coins }),
          });
        }
        if (gift.gems) {
          out.push({
            type: "gems",
            amount: gift.gems,
            label: t("newcomerGifts.gems", { count: gift.gems }),
          });
        }
        if (gift.powerPoints) {
          out.push({
            type: "powerPoints",
            amount: gift.powerPoints,
            label: t("newcomerGifts.powerPoints", { count: gift.powerPoints }),
          });
        }
        return out.length ? out : [{ type: "coins", amount: 0, label }];
      }
      default:
        return [{ type: "xp", amount: 1, label }];
    }
  };

  const handleClaim = () => {
    if (busy || !canClaim) return;
    setBusy(true);
    const r = claimNewcomerGift();
    refresh();
    if (!r.success) {
      const err = r.error === "cooldown"
        ? t("newcomerGifts.cooldown")
        : t("common.error");
      setMsg(err);
      setTimeout(() => setMsg(null), 2200);
      setBusy(false);
      return;
    }
    if (r.brawlerRevealId) {
      setRevealBrawler(r.brawlerRevealId);
    } else if (r.duplicateBrawlerGems) {
      setPendingRewards([{
        type: "gems",
        amount: r.duplicateBrawlerGems,
        label: t("newcomerGifts.gems", { count: r.duplicateBrawlerGems }),
      }]);
    } else if (typeof r.giftIndex === "number") {
      const infos = buildRewardInfos(r.giftIndex);
      if (infos.length) setPendingRewards(infos);
    }
    setBusy(false);
  };

  const afterReveal = () => {
    setRevealBrawler(null);
    refresh();
  };

  return (
    <>
      <motion.div
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 92,
          ...ASTRAL_SHELL.overlay,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 8,
        }}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            ...ASTRAL_SHELL.panel,
            width: "min(980px, 96vw)",
            height: "min(340px, 88vh)",
            minHeight: 260,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            color: "#fff",
            fontFamily: "var(--app-font-sans)",
          }}
        >
          <div style={ASTRAL_SHELL.radial} />
          <div style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            borderRadius: 20,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
            zIndex: 2,
          }} />

          {/* Header — как у Астрал */}
          <div style={{ ...ASTRAL_SHELL.header, position: "relative", zIndex: 3, flexShrink: 0 }}>
            <div style={ASTRAL_SHELL.headerGlow} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flexShrink: 0,
                background: "radial-gradient(circle at 35% 30%, #B388FF, #4A148C)",
                border: "2px solid #FFD740",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                boxShadow: "0 0 16px rgba(244,143,255,0.35)",
              }}>
                <EmojiIcon emoji="🎁" size={24} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 950,
                  fontSize: 16,
                  letterSpacing: "0.08em",
                  color: "#F7FBFF",
                  textShadow: "0 0 16px rgba(244,143,255,0.38)",
                }}>
                  <Tr id="newcomerGifts.title" />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 2, lineHeight: 1.3 }}>
                  <Tr id="newcomerGifts.subtitle" />
                </div>
                <div style={{ marginTop: 3, fontSize: 10, color: "#FFD740", fontWeight: 700 }}>
                  <Tr id="newcomerGifts.progress" params={{ current: st.claimedCount, total: NEWCOMER_GIFT_COUNT }} />
                </div>
              </div>
              <ModalCloseButton
                variant="inline"
                onClick={onClose}
                style={{ position: "static", minWidth: 48 }}
              />
            </div>
          </div>

          {/* Gift chain */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowX: "auto",
              overflowY: "hidden",
              padding: "8px 18px 10px",
              display: "flex",
              gap: 14,
              alignItems: "stretch",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              position: "relative",
              zIndex: 3,
            }}
          >
            {NEWCOMER_GIFT_CHAIN.map(gift => {
              const state = cardStateFor(gift.index, profile);
              const isActive = gift.index === activeIndex;
              const label = t(newcomerGiftLabelKey(gift), newcomerGiftLabelParams(gift, profile));
              const isBrawlerCard = gift.kind === "brawler_unlock";
              const showBrawlerHero = isBrawlerCard && !!brawlerId;
              const b = brawlerId ? getBrawlerById(brawlerId) : null;

              return (
                <div
                  key={gift.index}
                  ref={isActive ? activeRef : undefined}
                  style={{
                    flex: "0 0 auto",
                    width: isBrawlerCard ? 188 : 152,
                    minHeight: isBrawlerCard ? BRAWLER_CARD_MIN_H : CARD_MIN_H,
                    scrollSnapAlign: "center",
                    borderRadius: 14,
                    border: cardBorder(state),
                    background: cardBackground(state),
                    opacity: state === "locked" ? 0.58 : 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "5px 10px 7px",
                    boxShadow: state === "ready"
                      ? "0 0 22px rgba(255,215,0,0.38), inset 0 1px 0 rgba(255,255,255,0.10)"
                      : "inset 0 1px 0 rgba(255,255,255,0.08)",
                    position: "relative",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 8,
                    left: 10,
                    fontSize: 10,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.5)",
                  }}>
                    #{gift.index + 1}
                  </div>
                  {state === "claimed" && (
                    <div style={{
                      position: "absolute",
                      top: 7,
                      right: 10,
                      fontSize: 14,
                      color: "#A5D6A7",
                    }}>
                      <EmojiIcon emoji="✓" size={20} />
                    </div>
                  )}

                  {/* Preview — бойец по центру карточки */}
                  <div style={{
                    flex: 1,
                    width: "100%",
                    minHeight: showBrawlerHero ? BRAWLER_PREVIEW_PX : 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 9,
                    position: "relative",
                    overflow: "visible",
                  }}>
                    {showBrawlerHero ? (
                      <div style={{
                        width: BRAWLER_PREVIEW_PX + 12,
                        height: BRAWLER_PREVIEW_PX + 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}>
                        <GiftIconPreview gift={gift} brawlerId={brawlerId} hero />
                      </div>
                    ) : (
                      <GiftIconPreview gift={gift} brawlerId={brawlerId} />
                    )}
                  </div>

                  {showBrawlerHero && b && (
                    <div style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: "#fff",
                      textAlign: "center",
                      marginBottom: 2,
                      lineHeight: 1.2,
                      textShadow: "0 0 12px rgba(206,147,216,0.45)",
                      flexShrink: 0,
                    }}>
                      {brawlerName(b.id, b.name)}
                    </div>
                  )}

                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.9)",
                    textAlign: "center",
                    lineHeight: 1.3,
                    minHeight: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    padding: "0 2px",
                  }}>
                    {label}
                  </div>

                  {isActive && state === "ready" && (
                    <button
                      type="button"
                      onClick={handleClaim}
                      disabled={busy}
                      style={{
                        marginTop: 5,
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #FFD740, #FFA000)",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: 11,
                        cursor: busy ? "wait" : "pointer",
                        boxShadow: "0 4px 14px rgba(255,193,7,0.45)",
                        flexShrink: 0,
                      }}
                    >
                      <Tr id="newcomerGifts.claim" />
                    </button>
                  )}
                  {isActive && state === "wait" && (
                    <div style={{
                      marginTop: 5,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#FFD740",
                      textAlign: "center",
                      flexShrink: 0,
                    }}>
                      <Tr id="newcomerGifts.wait" params={{ time: formatHmsShort(timeLeft) }} />
                    </div>
                  )}
                  {!isActive && state === "locked" && (
                    <div style={{ marginTop: 5, fontSize: 10, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                      <EmojiIcon emoji="🔒" size={24} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {msg && (
            <div style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(26,0,51,0.92)",
              border: "1px solid rgba(206,147,216,0.4)",
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 12,
              color: "#fff",
              zIndex: 5,
            }}>
              {msg}
            </div>
          )}
        </motion.div>
      </motion.div>

      {revealBrawler && (
        <BrawlerRevealModal brawlerId={revealBrawler} onClose={afterReveal} />
      )}
      {pendingRewards && pendingRewards.length > 0 && (
        <RewardDropQueue
          rewards={pendingRewards}
          onDone={() => {
            setPendingRewards(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
