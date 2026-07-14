import { useMemo } from "react";
import { useI18n } from "../../i18n";
import { BRAWLERS } from "../../entities/BrawlerData";
import { getBrawlerDisplayName } from "../../utils/brawlerDisplay";
import { brawlerAvatarUrl } from "../../utils/modeAssets";
import {
  getBrawlerStarsCount,
  getBrawlerTrophies,
  getCurrentProfile,
} from "../../utils/localStorageAPI";
import { getProfileByPlayerId } from "../../utils/playerGiftSend";
import { computeBrawlerRankBarState } from "../../utils/brawlerRankUI";
import { RankBadgeIcon } from "../BrawlerRankBar";
import { TrophyIcon } from "../GameIcons";
import GlowingStar from "../GlowingStar";
import { EmojiIcon } from "../EmojiIcon";
import { Tr } from "../../i18n/Tr";

interface Props {
  targetPlayerId: string;
  targetUsername: string;
  onClose: () => void;
  onPick: (brawlerId: string) => void;
}

export default function PartyBrawlerPickerModal({
  targetPlayerId,
  targetUsername,
  onClose,
  onPick,
}: Props) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const targetProfile = getProfileByPlayerId(targetPlayerId);
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const targetOwned = new Set(targetProfile?.unlockedBrawlers ?? ["hana"]);

  const owned = useMemo(() => {
    if (!profile) return [];
    const myIds = profile.unlockedBrawlers || [];
    return BRAWLERS.filter(b => myIds.includes(b.id)).map(b => {
      const targetHas = targetOwned.has(b.id);
      const trophies = targetHas && targetProfile
        ? (getBrawlerTrophies(targetProfile, b.id) || targetProfile.trophies || 0)
        : 0;
      const peak = targetHas && targetProfile
        ? (targetProfile.brawlerTrophyPeak?.[b.id] ?? trophies)
        : 0;
      const rank = targetHas
        ? computeBrawlerRankBarState(trophies, peak).badgeRank
        : 0;
      const level = targetHas && targetProfile
        ? (targetProfile.brawlerLevels[b.id] || 1)
        : 0;
      const stars = targetHas && targetProfile
        ? getBrawlerStarsCount(targetProfile, b.id)
        : 0;
      return { brawler: b, trophies, rank, level, stars, targetHas };
    });
  }, [profile, targetProfile, targetOwned]);

  if (!profile) return null;

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 54, background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 55,
          width: "min(92vw, 520px)",
          maxHeight: "min(72vh, 520px)",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, rgba(20,10,48,0.97), rgba(6,3,22,0.99))",
          border: "1px solid rgba(206,147,216,0.45)",
          borderRadius: 14,
          boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#CE93D8" }}>
            <Tr id="party.suggestBrawler" />
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            <Tr id="party.suggestSubtitle" params={{ name: targetUsername }} />
          </div>
        </div>
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
        }}>
          {owned.map(({ brawler: b, trophies, rank, level, stars, targetHas }) => (
            <button
              key={b.id}
              type="button"
              disabled={!targetHas}
              onClick={() => targetHas && onPick(b.id)}
              style={{
                position: "relative",
                border: `2px solid ${targetHas ? `${b.color}88` : "rgba(255,255,255,0.15)"}`,
                borderRadius: 12,
                padding: 0,
                overflow: "hidden",
                cursor: targetHas ? "pointer" : "not-allowed",
                background: targetHas
                  ? `linear-gradient(180deg, ${b.color}33, rgba(0,0,0,0.5))`
                  : "rgba(0,0,0,0.55)",
                textAlign: "left",
                opacity: targetHas ? 1 : 0.65,
              }}
            >
              <img
                src={brawlerAvatarUrl(b.id)}
                alt=""
                style={{
                  width: "100%",
                  height: 100,
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                  filter: targetHas ? "none" : "grayscale(0.85) brightness(0.45)",
                }}
              />
              {!targetHas && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 42,
                  pointerEvents: "none",
                  textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                }}>
                  <EmojiIcon emoji="🔒" size={24} />
                </div>
              )}
              <div style={{
                position: "absolute",
                top: 6,
                left: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                pointerEvents: "none",
              }}>
                <RankBadgeIcon rank={rank} size={34} />
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  background: "rgba(0,0,0,0.65)",
                  borderRadius: 6,
                  padding: "2px 5px",
                  color: "#FFD700",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                }}>
                  <TrophyIcon size={10} /> {trophies}
                </span>
              </div>
              <div style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "radial-gradient(circle, #FFF8E1, #FFA000)",
                border: "2px solid #5D4037",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 900,
                color: "#3E2723",
              }}>
                {level}
              </div>
              <div style={{
                padding: "6px 8px 8px",
                background: "linear-gradient(0deg, rgba(0,0,0,0.85), transparent)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>
                  {getBrawlerDisplayName(b)}
                </div>
                <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <GlowingStar key={i} filled={i < stars} size={12} />
                  ))}
                </div>
                {!targetHas && (
                  <div style={{ fontSize: 8, color: "#FF8A80", marginTop: 4, fontWeight: 800 }}>
                    <Tr id="party.notOwned" params={{ name: targetUsername }} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: 8, borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose} style={{ width: "100%", fontSize: 11 }}>
            <Tr id="common.cancel" />
          </button>
        </div>
      </div>
    </>
  );
}
