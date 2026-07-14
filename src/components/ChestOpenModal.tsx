import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { useI18n, brawlerName, petName } from "../i18n";
import { CHESTS, type ChestRarity, type ChestRoll } from "../utils/chests";
import { BRAWLERS } from "../entities/BrawlerData";
import { getPetById } from "../entities/PetData";
import ChestItemScene from "./ChestItemScene";
import BrawlerRevealModal from "./BrawlerRevealModal";
import PetRevealModal from "./PetRevealModal";
import PinRevealModal from "./PinRevealModal";
import ProfileIconChestReveal from "./ProfileIconChestReveal";
import { getProfileIconImage, profileIconRewardFrameStyle } from "../utils/profileIconUtils";
import { PROFILE_ICON_BY_ID } from "../data/profileIcons";
import PetSvg from "./PetSvg";
import PinIcon from "./PinIcon";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import { EmojiIcon } from "./EmojiIcon";
import BrawlerAvatarImg from "./BrawlerAvatarImg";
import { preloadVoiceManifest } from "../audio/voiceLineService";
import { preloadIntroBrawlerModels } from "../utils/battleIntro/battleIntroPreload";
import { Tr } from "../i18n/Tr";

interface Props {
  rarity: ChestRarity;
  rolls: ChestRoll[];
  onClose: () => void;
}

type Phase = "dropping" | "brawler" | "brawlerDup" | "pet" | "pin" | "profileIcon" | "collecting" | "done";

// ── Keyframes ─────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes chestShake {
    0%,100% { transform: rotate(0deg); }
    15%      { transform: rotate(-5deg) translateX(-6px); }
    30%      { transform: rotate(5deg) translateX(8px); }
    50%      { transform: rotate(-3deg) translateX(-5px); }
    70%      { transform: rotate(3deg) translateX(5px); }
    85%      { transform: rotate(-2deg); }
  }
  @keyframes burstRay {
    0%   { opacity: 0; transform: scale(0.2) rotate(var(--rot)); }
    35%  { opacity: 1; transform: scale(1.4) rotate(var(--rot)); }
    100% { opacity: 0; transform: scale(2) rotate(var(--rot)); }
  }
  @keyframes counterPulse {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.15); }
  }
  @keyframes counterAppear {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  @keyframes brawlerGlow {
    0%,100% { box-shadow: 0 0 20px #FFD700, 0 4px 24px rgba(0,0,0,0.6); }
    50%     { box-shadow: 0 0 50px #FFD700, 0 0 80px #FFD70066; }
  }
  @keyframes silhouetteGrow {
    0%   { transform: scale(0.1) rotate(-540deg); filter: brightness(0) saturate(0); }
    65%  { transform: scale(1.06) rotate(4deg); filter: brightness(0) saturate(0) drop-shadow(0 0 40px rgba(255,255,255,0.7)); }
    82%  { transform: scale(0.97) rotate(-2deg); filter: brightness(0) saturate(0) drop-shadow(0 0 70px rgba(255,255,255,1)); }
    100% { transform: scale(1) rotate(0deg); filter: brightness(0) saturate(0) drop-shadow(0 0 90px rgba(255,255,255,1)); }
  }
  @keyframes brawlerReveal {
    0%   { filter: brightness(0) saturate(0); }
    100% { filter: brightness(1.4) saturate(1.6) drop-shadow(0 0 32px var(--glow)); }
  }
  @keyframes brawlerInfoIn {
    from { opacity: 0; transform: translateX(48px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes floatUp {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-10px); }
  }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 20px var(--gc); }
    50%     { box-shadow: 0 0 60px var(--gc), 0 0 100px var(--gc); }
  }
  @keyframes flyOut {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    25%  { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(0.2); }
  }
  @keyframes summaryIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tapHint {
    0%,70%,100% { opacity: 0.3; }
    35%         { opacity: 0.7; }
  }
`;

// BrawlerReveal is now handled by BrawlerRevealModal (full-screen portal)

// ── Summary ───────────────────────────────────────────────────────────────────
function Summary({ rolls, def }: { rolls: ChestRoll[]; def: ReturnType<typeof CHESTS[keyof typeof CHESTS]> }) {
  const { t } = useI18n();
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const coins = rolls.filter(r => r.type === "coins").reduce((s, r) => s + r.amount, 0);
  const gems  = rolls.filter(r => r.type === "gems").reduce((s, r) => s + r.amount, 0);
  const power = rolls.filter(r => r.type === "powerPoints").reduce((s, r) => s + r.amount, 0);
  const brawlerRoll = rolls.find(r => r.type === "brawler");
  const brawler = brawlerRoll?.brawlerId ? BRAWLERS.find(b => b.id === brawlerRoll.brawlerId) : null;
  const petRoll = rolls.find(r => r.type === "pet");
  const pet = petRoll?.petId ? getPetById(petRoll.petId) : null;
  const pinRoll = rolls.find(r => r.type === "pin");
  const pinId = pinRoll?.pinId;
  const iconRoll = rolls.find(r => r.type === "profileIcon");
  const iconId = iconRoll?.profileIconId;
  const iconDef = iconId ? PROFILE_ICON_BY_ID.get(iconId) : null;
  const brawlerDup = !!brawlerRoll?.brawlerDuplicate;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: "summaryIn 0.5s ease-out" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: def.color, letterSpacing: 4, textShadow: `0 0 20px ${def.color}` }}>
        <Tr id="chest.summary.total" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {coins > 0 && <SummaryCard icon={<CoinIcon size={32} />}  color="#FFD700" value={coins} label={t("chest.summary.coins")} />}
        {gems > 0  && <SummaryCard icon={<GemIcon size={32} />}   color="#40C4FF" value={gems}  label={t("chest.summary.gems")} />}
        {power > 0 && <SummaryCard icon={<PowerIcon size={32} />} color="#CE93D8" value={power} label={t("chest.summary.power")} />}
        {def.drops.xp > 0 && <SummaryCard icon={<EmojiIcon emoji="⭐" size={32} />} color="#FFD700" value={def.drops.xp} label={t("chest.summary.passXp")} />}
        {brawler && (
          <div style={{
            background: brawlerDup
              ? "linear-gradient(180deg, rgba(255,215,64,0.2) 0%, rgba(0,0,0,0.55) 100%)"
              : `linear-gradient(180deg, ${brawler.color}22 0%, rgba(0,0,0,0.55) 100%)`,
            border: `2px solid ${brawlerDup ? "#FFD54F" : brawler.color}`,
            borderRadius: 16, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: brawlerDup ? "0 0 32px rgba(255,213,79,0.45)" : `0 0 32px ${brawler.color}55`,
          }}>
            <BrawlerAvatarImg
              brawlerId={brawler.id}
              size={60}
              alt={brawlerName(brawler.id, brawler.name)}
              style={{
                borderRadius: 8,
                filter: `drop-shadow(0 0 8px ${brawlerDup ? "#FFD54F" : brawler.color})`,
              }}
            />
            <div>
              <div style={{
                fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 4,
                color: brawlerDup ? "#FFD54F" : brawler.color,
              }}>
                <Tr id={brawlerDup ? "chest.summary.duplicateStar" : "chest.summary.newBrawler"} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: brawlerDup ? "#FFD54F" : brawler.color }}>
                {brawlerName(brawler.id, brawler.name)}
              </div>
              {!brawlerDup && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>
                  {brawler.role.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}
        {iconId && (
          <div style={{
            background: "rgba(0,0,0,0.55)", border: "2px solid #CE93D8",
            borderRadius: 16, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 0 32px rgba(206,147,216,0.45)",
          }}>
            <img
              src={getProfileIconImage(iconId, base)}
              alt=""
              style={profileIconRewardFrameStyle(56, {
                border: "2px solid #CE93D8",
                boxShadow: "0 0 16px rgba(206,147,216,0.55)",
              })}
            />
            <div>
              <div style={{ fontSize: 9, color: "#CE93D8", fontWeight: 900, letterSpacing: 2 }}><Tr id="chest.summary.icon" /></div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#E1BEE7" }}>{iconDef?.label}</div>
            </div>
          </div>
        )}
        {pet && (
          <div style={{
            background: `linear-gradient(180deg, ${pet.color}22 0%, rgba(0,0,0,0.55) 100%)`,
            border: `2px solid ${pet.color}`,
            borderRadius: 16, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: `0 0 32px ${pet.color}55`,
          }}>
            <PetSvg pet={pet} size={64} animated haloPulse={false} />
            <div>
              <div style={{ fontSize: 9, color: pet.color, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}><Tr id="chest.summary.newPet" /></div>
              <div style={{ fontSize: 18, fontWeight: 900, color: pet.color }}>{petName(pet.id, pet.name)}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{pet.effectLabel}</div>
            </div>
          </div>
        )}
        {pinId && (
          <div style={{
            background: "rgba(0,0,0,0.55)",
            border: "2px solid #CE93D8",
            borderRadius: 16, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 0 32px rgba(206,147,216,0.45)",
          }}>
            <PinIcon pinId={pinId} size={64} glow animated />
            <div>
              <div style={{ fontSize: 12, color: "#CE93D8", fontWeight: 900, letterSpacing: 2 }}><Tr id="chest.summary.newPin" /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string }) {
  return (
    <div style={{
      background: `rgba(0,0,0,0.4)`, border: `1.5px solid ${color}66`,
      borderRadius: 14, padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ filter: `drop-shadow(0 0 8px ${color})`, display: "flex", alignItems: "center" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, textShadow: `0 0 10px ${color}` }}>+{value}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Flying particles during collecting ────────────────────────────────────────
type FlyType = "coins" | "gems" | "powerPoints";

function FlyIcon({ type, size = 28 }: { type: FlyType; size?: number }) {
  if (type === "coins")       return <CoinIcon size={size} />;
  if (type === "gems")        return <GemIcon size={size} />;
  return <PowerIcon size={size} />;
}

const FLY_FX: Record<FlyType, { fx: string; fy: string }> = {
  coins:       { fx: "45vw",   fy: "-46vh" },
  gems:        { fx: "46.5vw", fy: "-46vh" },
  powerPoints: { fx: "48vw",   fy: "-46vh" },
};

function CollectOverlay({ rolls }: { rolls: ChestRoll[] }) {
  const particles: { id: number; type: FlyType; ox: number; oy: number; delay: number }[] = [];
  let id = 0;
  for (const r of rolls) {
    if (
      r.type === "brawler" || r.type === "pet" || r.type === "pin" || r.type === "profileIcon"
      || (r.type !== "coins" && r.type !== "gems" && r.type !== "powerPoints")
    ) continue;
    const count = Math.min((r.amount > 20 ? 10 : r.amount > 5 ? 6 : 3), 12);
    for (let i = 0; i < count; i++) {
      particles.push({
        id: id++,
        type: r.type,
        ox: (Math.random() - 0.5) * 160,
        oy: (Math.random() - 0.5) * 100,
        delay: i * 55,
      });
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {particles.map(p => {
        const m = FLY_FX[p.type];
        if (!m) return null;
        return (
          <div key={p.id} style={{
            position: "absolute", left: "50%", top: "50%",
            transform: `translate(calc(-50% + ${p.ox}px), calc(-50% + ${p.oy}px))`,
            "--fx": m.fx, "--fy": m.fy,
            animation: "flyOut 0.85s ease-in forwards",
            animationDelay: `${p.delay}ms`,
            opacity: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          } as React.CSSProperties}>
            <FlyIcon type={p.type} size={28} />
          </div>
        );
      })}
    </div>
  );
}

// ── Item type meta (for overlay text) ────────────────────────────────────────
function useTypeMeta() {
  const { t } = useI18n();
  return {
    coins:       { icon: "🪙", color: "#FFD700", label: t("chest.roll.coins") },
    gems:        { icon: "💎", color: "#40C4FF", label: t("chest.roll.gems") },
    powerPoints: { icon: "⚡", color: "#CE93D8", label: t("chest.roll.power") },
  } as Record<string, { icon: string; color: string; label: string }>;
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ChestOpenModal({ rarity, rolls, onClose }: Props) {
  const { t } = useI18n();
  const TYPE_META = useTypeMeta();
  const def = CHESTS[rarity];

  useEffect(() => {
    void preloadVoiceManifest();
    const brawlerIds = rolls
      .filter((r): r is ChestRoll & { brawlerId: string } => r.type === "brawler" && !!r.brawlerId)
      .map(r => r.brawlerId);
    if (brawlerIds.length > 0) preloadIntroBrawlerModels(brawlerIds);
  }, [rolls]);
  const phaseFor = (r: ChestRoll | undefined): Phase => {
    if (r?.type === "brawler") return r.brawlerDuplicate ? "brawlerDup" : "brawler";
    if (r?.type === "pet") return "pet";
    if (r?.type === "pin") return "pin";
    if (r?.type === "profileIcon") return "profileIcon";
    return "dropping";
  };
  const [phase, setPhase]             = useState<Phase>(phaseFor(rolls[0]));
  const [currentDrop, setCurrentDrop] = useState(0);
  const canTapRef = useRef(true);

  // current roll
  const roll = currentDrop >= 0 && currentDrop < rolls.length ? rolls[currentDrop] : null;

  // remaining = items still to show AFTER the current one
  const remaining = currentDrop >= 0 ? rolls.length - currentDrop - 1 : rolls.length;
  const nextRoll = rolls[currentDrop + 1] ?? null;
  const nextIsSpecial = nextRoll?.type === "brawler" || nextRoll?.type === "pet" || nextRoll?.type === "pin" || nextRoll?.type === "profileIcon";

  // ── Advance to next item ──────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (!canTapRef.current) return;
    canTapRef.current = false;
    setTimeout(() => { canTapRef.current = true; }, 180);

    setCurrentDrop(prev => {
      const next = prev + 1;
      if (next >= rolls.length) {
        setPhase("collecting");
        setTimeout(() => setPhase("done"), 1200);
        return prev;
      }
      setPhase(phaseFor(rolls[next]));
      return next;
    });
  }, [rolls]);

  // ── Tap handler (brawler/pet phases own their taps via their own modals) ──
  const handleTap = useCallback(() => {
    if (phase === "done") { onClose(); return; }
    if (phase === "brawler" || phase === "brawlerDup" || phase === "pet" || phase === "pin" || phase === "profileIcon") return;
    if (phase === "dropping") advance();
  }, [phase, advance, onClose]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const isResourceDrop = phase === "dropping" && roll && roll.type !== "brawler" && roll.type !== "pet" && roll.type !== "pin" && roll.type !== "profileIcon";
  const isBrawlerDrop  = phase === "brawler"  && roll?.type === "brawler" && !roll.brawlerDuplicate;
  const isBrawlerDup   = phase === "brawlerDup" && roll?.type === "brawler" && roll.brawlerDuplicate;
  const isPetDrop      = phase === "pet"      && roll?.type === "pet";
  const isPinDrop      = phase === "pin"      && roll?.type === "pin";
  const isIconDrop     = phase === "profileIcon" && roll?.type === "profileIcon";
  const meta = roll ? TYPE_META[roll.type] : null;

  const modal = (
    <div
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: `radial-gradient(ellipse at center, ${def.color}18 0%, rgba(0,0,5,0.97) 72%)`,
        backdropFilter: "blur(14px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <style>{STYLES}</style>

      {/* ── Chest name (hidden during resource drop) ── */}
      {!isResourceDrop && (
        <div style={{
          position: "absolute", top: 22,
          fontSize: 18, fontWeight: 900, letterSpacing: 4,
          color: def.color, textShadow: `0 0 28px ${def.color}`,
          textTransform: "uppercase", zIndex: 3,
        }}>
          {def.name}
        </div>
      )}

      {/* ── 3D resource drop ── */}
      {isResourceDrop && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <ChestItemScene
            key={currentDrop}
            type={roll.type as "coins" | "gems" | "powerPoints"}
            amount={roll.amount}
            onAllSettled={() => { /* settled = user can still tap to advance */ }}
          />

          {/* Amount overlay */}
          {meta && (
            <div style={{
              position: "absolute", top: "14%", left: "50%", transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              zIndex: 4, pointerEvents: "none",
            }}>
              <div style={{
                fontSize: 72, fontWeight: 900, lineHeight: 1,
                color: meta.color,
                textShadow: `0 0 30px ${meta.color}, 0 4px 12px rgba(0,0,0,0.8)`,
                letterSpacing: 2,
              }}>
                +{roll.amount}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700, letterSpacing: 3,
                color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
              }}>
                {meta.label}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Brawler reveal (separate full-screen portal) ── */}
      {isBrawlerDrop && roll.brawlerId && (
        <BrawlerRevealModal
          brawlerId={roll.brawlerId}
          onDone={() => advance()}
        />
      )}

      {isBrawlerDup && roll.brawlerId && (
        <BrawlerRevealModal
          brawlerId={roll.brawlerId}
          duplicate
          onDone={() => advance()}
        />
      )}

      {/* ── Pet reveal (separate full-screen portal) ── */}
      {isPetDrop && roll.petId && (
        <PetRevealModal
          petId={roll.petId}
          onDone={() => advance()}
        />
      )}

      
      {isPinDrop && roll.pinId && (
        <PinRevealModal pinId={roll.pinId} onDone={() => advance()} />
      )}

      {isIconDrop && roll.profileIconId && (
        <ProfileIconChestReveal iconId={roll.profileIconId} onDone={() => advance()} />
      )}

      {/* ── Collecting overlay ── */}
      {phase === "collecting" && <CollectOverlay rolls={rolls} />}

      {/* ── Done / summary ── */}
      {phase === "done" && (
        <div style={{ zIndex: 4, maxWidth: 680, width: "90%", pointerEvents: "none" }}>
          <Summary rolls={rolls} def={def} />
        </div>
      )}

      {/* ── Bottom-right counter (hidden during brawler — BrawlerRevealModal is on top) ── */}
      {phase === "dropping" && remaining > 0 && (
        <div
          key={remaining}
          style={{
            position: "absolute",
            bottom: 28, right: 28,
            width: 58, height: 58,
            background: "#CC1111",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2.5px solid #FF4444",
            boxShadow: nextIsSpecial
              ? "0 0 0 0 transparent"
              : "0 4px 16px rgba(0,0,0,0.6)",
            animation: nextIsSpecial
              ? "counterAppear 0.3s ease-out, brawlerGlow 1s ease-in-out infinite"
              : "counterAppear 0.3s ease-out",
            zIndex: 10,
          }}
        >
          <span style={{
            fontSize: 28, fontWeight: 900, lineHeight: 1,
            color: nextIsSpecial ? "#FFD700" : "white",
            textShadow: nextIsSpecial ? "0 0 14px #FFD700, 0 0 30px #FFD70088" : "0 2px 6px rgba(0,0,0,0.8)",
          }}>
            {remaining}
          </span>
        </div>
      )}

      {/* ── Tap hint ── */}
      {(phase === "dropping" || phase === "done") && (
        <div style={{
          position: "absolute", bottom: 40,
          left: "50%", transform: "translateX(-50%)",
          fontSize: 11, color: "rgba(255,255,255,0.3)",
          letterSpacing: 2, textTransform: "uppercase",
          animation: "tapHint 2.5s ease-in-out infinite",
          zIndex: 3, whiteSpace: "nowrap",
        }}>
          <Tr id="chest.tapContinue" />
        </div>
      )}
    </div>
  );

  return createPortal(modal, getAppPortalRoot());
}
