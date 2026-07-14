import { useMemo, useState, useEffect, useLayoutEffect, type CSSProperties } from "react";
import type { Club } from "../utils/clubs";
import { getMyClub, promoteCurrentUserToClubFounder } from "../utils/clubs";
import { getCurrentProfile, getCurrentUsername } from "../utils/localStorageAPI";
import { publicAssetBase } from "../utils/modeAssets";
import {
  TREASURY_MAX_PCT,
  TREASURY_MAX_BATTLE_BONUS,
  TREASURY_FUND_CAP_COINS,
  buildTreasuryLeaderboard,
  canChangeTreasuryPct,
  computeTreasuryDeduction,
  formatMsLeft,
  fundTreasurePoints,
  getClubTreasury,
  getMemberShare,
  getPlayerTreasuryBattleBonuses,
  getResourceBattleBonusPct,
  getTreasuryProfileState,
  pileVisualCount,
  endTreasuryBoostVoteEarly,
  getMyTreasuryBoostVote,
  resolveTreasuryBoostVote,
  setTreasuryContributionPct,
  startTreasuryBoostVote,
  subscribeTreasuryDeposits,
  TREASURY_BATTLE_RESOURCE_CAP,
  voteTreasuryBoost,
  ensureTreasuryProfileReady,
  type TreasuryResource,
} from "../utils/clubTreasury";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import SpinningModel3D from "./SpinningModel3D";
import ClubTreasuryPile from "./ClubTreasuryPile";
import ClubTreasuryInfoModal from "./ClubTreasuryInfoModal";
import InfoIconButton from "./InfoIconButton";
import { useI18nOptional } from "../i18n/I18nProvider";
import { Tr } from "../i18n/Tr";
import { EmojiIcon } from "./EmojiIcon";

const RESOURCES: TreasuryResource[] = ["coins", "gems", "powerPoints"];
const TREASURY_BG = `${publicAssetBase}images/club-treasury-bg.png`;

const RESOURCE_3D: Record<TreasuryResource, { path: string; color: string; ambient: number; dir: number }> = {
  coins: { path: "models/coin.glb", color: "#FFD700", ambient: 3.5, dir: 3.5 },
  gems: { path: "models/gem.glb", color: "#40C4FF", ambient: 2.5, dir: 2.5 },
  powerPoints: { path: "models/powerpoint.glb", color: "#CE93D8", ambient: 3.0, dir: 3.0 },
};

const iconSlot: CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
};

function TreasuryResourceIcon3D({
  resource,
  size = 22,
  frozen = false,
}: {
  resource: TreasuryResource;
  size?: number;
  frozen?: boolean;
}) {
  const spec = RESOURCE_3D[resource];
  const px = Math.round(size * 1.3);
  if (frozen) {
    return (
      <SpinningModel3D
        modelPath={spec.path}
        size={px}
        color={spec.color}
        ambientMult={spec.ambient}
        dirMult={spec.dir}
        frozen
      />
    );
  }
  if (resource === "coins") return <CoinIcon size={size} />;
  if (resource === "gems") return <GemIcon size={size} />;
  return <PowerIcon size={size} />;
}

function BattleBonusLine({ resource, label }: { resource: TreasuryResource; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
      <span style={iconSlot}>
        <TreasuryResourceIcon3D resource={resource} size={20} />
      </span>
      <span>{label}</span>
    </div>
  );
}

function Share3DRow({ coins, gems, powerPoints }: { coins: number; gems: number; powerPoints: number }) {
  const item: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
  };
  const rows: { resource: TreasuryResource; amount: number }[] = [
    { resource: "coins", amount: coins },
    { resource: "gems", amount: gems },
    { resource: "powerPoints", amount: powerPoints },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
      {rows.map(({ resource, amount }) => (
        <span key={resource} style={item}>
          <span style={{ ...iconSlot, width: 22, height: 22 }}>
            <TreasuryResourceIcon3D resource={resource} size={16} frozen />
          </span>
          {amount.toLocaleString("ru-RU")}
        </span>
      ))}
    </div>
  );
}

interface Props {
  club: Club;
  onChange: () => void;
  onBack: () => void;
}

export default function ClubTreasuryView({ club, onChange, onBack }: Props) {
  const { t } = useI18nOptional();
  const me = getCurrentUsername();
  const profile = getCurrentProfile();
  const liveClub = useMemo(() => {
    const fresh = getMyClub();
    return fresh?.id === club.id ? fresh : club;
  }, [club]);
  const isFounder = !!me && me === liveClub.createdBy;
  const [resIdx, setResIdx] = useState(0);
  const [pctDraft, setPctDraft] = useState(() => {
    const p = getCurrentProfile();
    return p ? getTreasuryProfileState(p).contributionPct : 0;
  });
  const [showInfo, setShowInfo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useLayoutEffect(() => {
    ensureTreasuryProfileReady();
    let needsRefresh = false;
    if (me && liveClub.createdBy !== me) {
      if (promoteCurrentUserToClubFounder(club.id)) needsRefresh = true;
    }
    if (resolveTreasuryBoostVote(club.id)) needsRefresh = true;
    if (needsRefresh) onChange();
  }, [club.id, me, liveClub.createdBy, onChange]);

  useEffect(() => {
    const p = getCurrentProfile();
    if (p) setPctDraft(getTreasuryProfileState(p).contributionPct);
  }, [club.id]);

  useEffect(() => subscribeTreasuryDeposits(() => onChange()), [onChange]);

  const treasury = getClubTreasury(liveClub);
  const resource = RESOURCES[resIdx]!;
  const totals = { coins: treasury.coins, gems: treasury.gems, powerPoints: treasury.powerPoints };
  const amount = totals[resource];
  const visualCount = pileVisualCount(amount, resource);
  const leaderboard = useMemo(() => buildTreasuryLeaderboard(liveClub), [liveClub]);
  const fundTp = fundTreasurePoints(treasury);
  const battleBonuses = getPlayerTreasuryBattleBonuses(profile, liveClub);
  const resourceBattlePct = getResourceBattleBonusPct(resource, profile, liveClub);
  const resourceCap = TREASURY_BATTLE_RESOURCE_CAP[resource];
  const myShare = me ? getMemberShare(treasury, me) : { coins: 0, gems: 0, powerPoints: 0 };
  const state = profile ? getTreasuryProfileState(profile) : null;
  const pctGate = profile ? canChangeTreasuryPct(profile) : { ok: true };
  const savedPct = state?.contributionPct ?? 0;
  const pctUnchanged = pctDraft === savedPct;
  const pctSplitExample = useMemo(
    () => computeTreasuryDeduction(100, savedPct),
    [savedPct],
  );
  const activeVote = treasury.boostVote && Date.now() < treasury.boostVote.endsAt
    ? treasury.boostVote
    : null;
  const myVote = getMyTreasuryBoostVote(liveClub);

  const applyPct = () => {
    const r = setTreasuryContributionPct(pctDraft);
    if (r.success) {
      setMsg(t("clubs.treasury.pctSaved"));
      onChange();
    } else if (r.error === "cooldown") {
      setMsg(t("clubs.treasury.pctCooldown"));
    } else {
      setMsg(t("clubs.treasury.pctError"));
    }
    setTimeout(() => setMsg(null), 2500);
  };

  const cycleResource = (dir: -1 | 1) => {
    setResIdx((i) => (i + dir + RESOURCES.length) % RESOURCES.length);
  };

  const resourceLabel = resource === "coins"
    ? t("clubs.treasury.resourceCoins")
    : resource === "gems"
      ? t("clubs.treasury.resourceGems")
      : t("clubs.treasury.resourcePower");

  const resourceIcon = (
    <span style={iconSlot}>
      <TreasuryResourceIcon3D resource={resource} size={24} />
    </span>
  );

  const resourceBattleLabel = resource === "coins"
    ? t("clubs.treasury.battleHp", { pct: resourceBattlePct.toFixed(1) })
    : resource === "gems"
      ? t("clubs.treasury.battleSpeed", { pct: resourceBattlePct.toFixed(1) })
      : t("clubs.treasury.battleDamage", { pct: resourceBattlePct.toFixed(1) });

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <img
        src={TREASURY_BG}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0,
        }}>
          <button type="button" onClick={onBack} style={backBtn}><Tr id="clubs.backToMenu" /></button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 900, color: "#FFD740" }}><Tr id="clubs.treasury.title" /></div>
          <InfoIconButton onClick={() => setShowInfo(true)} />
        </div>

        <div style={{
          margin: "8px 12px 0", padding: "10px 12px", borderRadius: 10,
          background: "rgba(255,87,34,0.15)", border: "1px solid rgba(255,152,0,0.45)",
          fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,0.9)", flexShrink: 0,
        }}>
          <EmojiIcon emoji="⚠️" size={18} /> <Tr id="clubs.treasury.warningBanner" />
        </div>

        {msg && (
          <div style={{
            margin: "6px 12px 0", padding: "8px 10px", borderRadius: 8,
            background: "rgba(76,175,80,0.2)", color: "#A5D6A7", fontSize: 12, fontWeight: 700,
          }}>{msg}</div>
        )}

        <div style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(220px, 28%) minmax(0, 1fr)",
          gap: 10,
          padding: "10px 12px 12px",
          overflow: "hidden",
        }}>
          {/* Левая колонка: топ вкладчиков — своя прокрутка только при длинном списке */}
          <aside style={{
            minHeight: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,215,64,0.25)",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <div style={{
              flexShrink: 0,
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.08em",
              color: "#FFD740",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}><Tr id="clubs.treasury.leaderboard" /></div>
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "6px 8px",
              overscrollBehavior: "contain",
            }}>
              {leaderboard.map((row, idx) => (
                <div key={row.username} style={{
                  display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 6px", borderRadius: 8,
                  background: row.username === me ? "rgba(255,215,64,0.12)" : "transparent", marginBottom: 2,
                }}>
                  <span style={{
                    width: 22, textAlign: "center", fontWeight: 900, fontSize: 12, flexShrink: 0, marginTop: 2,
                    color: idx < 3 ? "#FFD740" : "rgba(255,255,255,0.5)",
                  }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}>
                      <div style={{
                        fontSize: 12, fontWeight: 800, color: "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        minWidth: 0,
                      }}>{row.username}</div>
                      <span style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 900,
                        color: row.contributionPct > 0 ? "#69F0AE" : "rgba(255,255,255,0.45)",
                        background: row.contributionPct > 0 ? "rgba(105,240,174,0.12)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${row.contributionPct > 0 ? "rgba(105,240,174,0.35)" : "rgba(255,255,255,0.12)"}`,
                        borderRadius: 6,
                        padding: "2px 6px",
                      }}>
                        <Tr id="clubs.treasury.memberPct" params={{ pct: row.contributionPct }} />
                      </span>
                    </div>
                    <Share3DRow coins={row.coins} gems={row.gems} powerPoints={row.powerPoints} />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Правая колонка: куча + настройки — общая прокрутка вниз */}
          <section style={{
            minHeight: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,0,0,0.28)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
            }}>
              <div style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 360,
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  gap: 8,
                  flexWrap: "wrap",
                  flexShrink: 0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {resourceIcon}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{resourceLabel}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD740" }}>{amount.toLocaleString("ru-RU")}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#69F0AE", marginTop: 2 }}>
                        {resourceBattleLabel}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>
                        {t("clubs.treasury.resourceCapHint", {
                          cap: resourceCap.toLocaleString("ru-RU"),
                          max: TREASURY_MAX_BATTLE_BONUS,
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" onClick={() => cycleResource(-1)} style={arrowBtn}>←</button>
                    <button type="button" onClick={() => cycleResource(1)} style={arrowBtn}>→</button>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 300, display: "flex", flexDirection: "column" }}>
                  <ClubTreasuryPile resource={resource} visualCount={visualCount} />
                </div>
              </div>

            <div style={{
              padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11, color: "rgba(255,255,255,0.85)",
            }}>
              <div>
                <div style={{ fontWeight: 800, color: "#FFD740", marginBottom: 6 }}><Tr id="clubs.treasury.bonusTitle" /></div>
                <BattleBonusLine
                  resource="coins"
                  label={t("clubs.treasury.bonusLineHp", { pct: battleBonuses.hpPct.toFixed(1), max: TREASURY_MAX_BATTLE_BONUS })}
                />
                <BattleBonusLine
                  resource="gems"
                  label={t("clubs.treasury.bonusLineSpeed", { pct: battleBonuses.speedPct.toFixed(1), max: TREASURY_MAX_BATTLE_BONUS })}
                />
                <BattleBonusLine
                  resource="powerPoints"
                  label={t("clubs.treasury.bonusLineDamage", { pct: battleBonuses.damagePct.toFixed(1), max: TREASURY_MAX_BATTLE_BONUS })}
                />
                <div style={{ marginTop: 4, opacity: 0.8 }}>
                  {t("clubs.treasury.fundProgress", {
                    current: fundTp.toLocaleString("ru-RU"),
                    cap: TREASURY_FUND_CAP_COINS.toLocaleString("ru-RU"),
                  })}
                </div>
                {treasury.boostActiveUntil && Date.now() < treasury.boostActiveUntil && (
                  <div style={{ marginTop: 6, color: "#69F0AE", fontWeight: 800 }}><Tr id="clubs.treasury.boostActive" /></div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 800, color: "#FFD740", marginBottom: 4 }}><Tr id="clubs.treasury.myShare" /></div>
                <Share3DRow coins={myShare.coins} gems={myShare.gems} powerPoints={myShare.powerPoints} />
                {state && (
                  <div style={{ marginTop: 4, opacity: 0.85 }}><Tr id="clubs.treasury.myPct" params={{ pct: state.contributionPct }} /></div>
                )}
              </div>
            </div>

            <div style={{ padding: "10px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#FFD740", marginBottom: 6 }}>
                <Tr id="clubs.treasury.pctLabel" params={{ max: TREASURY_MAX_PCT }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={TREASURY_MAX_PCT}
                  step={1}
                  value={pctDraft}
                  onInput={(e) => setPctDraft(Number((e.target as HTMLInputElement).value))}
                  style={{ flex: 1, cursor: "pointer" }}
                />
                <span style={{ fontWeight: 900, color: "#fff", minWidth: 36 }}>{pctDraft}%</span>
                <button
                  type="button"
                  onClick={applyPct}
                  disabled={pctUnchanged || !pctGate.ok}
                  style={{
                    ...saveBtn,
                    opacity: pctUnchanged || !pctGate.ok ? 0.5 : 1,
                    cursor: pctUnchanged || !pctGate.ok ? "not-allowed" : "pointer",
                  }}
                >
                  <span style={{ color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
                    <Tr id="clubs.treasury.pctSave" />
                  </span>
                </button>
              </div>
              {!pctGate.ok && pctGate.msLeft != null && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                  <Tr id="clubs.treasury.pctCooldownHint" params={{ time: formatMsLeft(pctGate.msLeft) }} />
                </div>
              )}
              {savedPct > 0 && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.45 }}>
                  <Tr id="clubs.treasury.pctSplitExample" params={{
                    pct: savedPct,
                    vault: pctSplitExample.toVault,
                    player: pctSplitExample.toPlayer,
                  }} />
                </div>
              )}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                <Tr id="clubs.treasury.pctLockedHint" />
              </div>
            </div>

            <div style={{ padding: "0 12px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#CE93D8", marginBottom: 6 }}>
                <Tr id="clubs.treasury.voteTitle" />
              </div>
              {activeVote ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    {t("clubs.treasury.voteActive", {
                      yes: activeVote.yes.length,
                      total: liveClub.members.length,
                      left: formatMsLeft(activeVote.endsAt - Date.now()),
                    })}
                  </span>
                  {myVote ? (
                    <span style={{ fontSize: 11, fontWeight: 800, color: myVote === "yes" ? "#A5D6A7" : "#EF9A9A" }}>
                      {myVote === "yes" ? t("clubs.treasury.voteYourYes") : t("clubs.treasury.voteYourNo")}
                    </span>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={voteYes}
                        onClick={() => {
                          const r = voteTreasuryBoost(liveClub.id, true);
                          if (r.success) onChange();
                          else if (r.error === "alreadyVoted") setMsg(t("clubs.treasury.voteAlreadyVoted"));
                          else setMsg(t("clubs.treasury.voteError"));
                          setTimeout(() => setMsg(null), 2500);
                        }}
                      >
                        <Tr id="clubs.treasury.voteYes" />
                      </button>
                      <button
                        type="button"
                        style={voteNo}
                        onClick={() => {
                          const r = voteTreasuryBoost(liveClub.id, false);
                          if (r.success) onChange();
                          else if (r.error === "alreadyVoted") setMsg(t("clubs.treasury.voteAlreadyVoted"));
                          else setMsg(t("clubs.treasury.voteError"));
                          setTimeout(() => setMsg(null), 2500);
                        }}
                      >
                        <Tr id="clubs.treasury.voteNo" />
                      </button>
                    </div>
                  )}
                  {isFounder && (
                    <button
                      type="button"
                      style={voteEndEarly}
                      onClick={() => {
                        const r = endTreasuryBoostVoteEarly(liveClub.id);
                        if (r.success) {
                          setMsg(r.passed ? t("clubs.treasury.voteEndedPassed") : t("clubs.treasury.voteEndedFailed"));
                          onChange();
                        } else if (r.error === "notOwner") setMsg(t("clubs.treasury.voteOwnerOnly"));
                        else setMsg(t("clubs.treasury.voteError"));
                        setTimeout(() => setMsg(null), 2500);
                      }}
                    >
                      <Tr id="clubs.treasury.voteEndEarly" />
                    </button>
                  )}
                </div>
              ) : isFounder ? (
                <button type="button" style={voteStart} onClick={() => {
                  const r = startTreasuryBoostVote(liveClub.id);
                  if (r.success) onChange();
                  else if (r.error === "notOwner") setMsg(t("clubs.treasury.voteOwnerOnly"));
                  else if (r.error === "activeVote") setMsg(t("clubs.treasury.voteAlreadyActive"));
                  else setMsg(t("clubs.treasury.voteError"));
                  setTimeout(() => setMsg(null), 2500);
                }}>
                  <Tr id="clubs.treasury.voteStart" />
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                  <Tr id="clubs.treasury.voteFounderOnly" />
                </span>
              )}
            </div>
            </div>
          </section>
        </div>

        {showInfo && <ClubTreasuryInfoModal onClose={() => setShowInfo(false)} />}
      </div>
    </div>
  );
}

const backBtn: CSSProperties = {
  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 800, fontSize: 12,
};
const arrowBtn: CSSProperties = {
  width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 16,
};
const saveBtn: CSSProperties = {
  padding: "6px 14px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #FFD740, #FF8F00)", color: "#ffffff", fontWeight: 900, fontSize: 11, cursor: "pointer",
  textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
};
const voteStart: CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(206,147,216,0.5)",
  background: "rgba(156,39,176,0.25)", color: "#E1BEE7", fontWeight: 800, fontSize: 11, cursor: "pointer",
};
const voteYes: CSSProperties = { ...voteStart, background: "rgba(76,175,80,0.25)", borderColor: "rgba(129,199,132,0.5)", color: "#A5D6A7" };
const voteNo: CSSProperties = { ...voteStart, background: "rgba(244,67,54,0.2)", borderColor: "rgba(239,154,154,0.5)", color: "#EF9A9A" };
const voteEndEarly: CSSProperties = {
  ...voteStart,
  alignSelf: "flex-start",
  background: "rgba(255,152,0,0.2)",
  borderColor: "rgba(255,183,77,0.5)",
  color: "#FFCC80",
};
