import { useEffect, useState } from "react";
import {
  isStarGuardianActive, getStarGuardianDaysRemaining,
  isMainDailyAvailable, claimMainDaily, getMsUntilMainDaily,
  isSecondaryDailyAvailable, getDailySecondaryOptions, claimSecondaryDaily,
  isSpecialDailyAvailable, claimSpecialDaily, getMsUntilSpecialDaily,
  consumePowerUpToken, getStarGuardian, ensureDevPowerUpToken,
  MAIN_DAILY_COINS, MAIN_DAILY_GEMS, MAIN_DAILY_POWER,
  SPECIAL_REWARD_INTERVAL_DAYS,
  type SecondaryRewardOption,
} from "../utils/subscription";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { formatGameDayCountdown, getMsUntilGameDayReset } from "../utils/gameDay";
import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import { BRAWLERS } from "../entities/BrawlerData";
import { brawlerAvatarUrl } from "../utils/modeAssets";
import { PageBody } from "../components/PageChrome";
import { RARITY_AVATAR_BG } from "./CharacterSelect";
import { useI18n, brawlerName } from "../i18n";
import StarGuardianIcon from "../components/StarGuardianIcon";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props { onBack: () => void }

export default function StarGuardianRewardsPage({ onBack }: Props) {
  const { t } = useI18n();
  const [, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick(x => x + 1);

  // Auto-refresh every 1 sec so timers/badges update.
  useEffect(() => {
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ensureDevPowerUpToken();
    refresh();
  }, []);

  const [activeDrop, setActiveDrop] = useState<{ q: RewardInfo[]; i: number } | null>(null);

  const startDrop = (q: RewardInfo[]) => setActiveDrop({ q, i: 0 });

  const secondaryToReward = (opt: SecondaryRewardOption): RewardInfo => {
    if (opt.type === "coins") {
      return { type: "coins", amount: opt.amount, label: t("daily.reward.coins", { count: opt.amount }) };
    }
    if (opt.type === "gems") {
      return { type: "gems", amount: opt.amount, label: t("daily.reward.gems", { count: opt.amount }) };
    }
    return { type: "powerPoints", amount: opt.amount, label: t("daily.reward.power", { count: opt.amount }) };
  };

  const handleMainDailyClaim = () => {
    const r = claimMainDaily();
    if (!r.claimed) return;
    refresh();
    startDrop([
      { type: "coins", amount: r.coins, label: t("daily.reward.coins", { count: r.coins }) },
      { type: "gems", amount: r.gems, label: t("daily.reward.gems", { count: r.gems }) },
      { type: "powerPoints", amount: r.powerPoints, label: t("daily.reward.power", { count: r.powerPoints }) },
    ]);
  };

  const profile = getCurrentProfile();
  const sg = getStarGuardian();
  const active = isStarGuardianActive();
  const daysLeft = getStarGuardianDaysRemaining();

  const secondaryOptions = active ? getDailySecondaryOptions() : [];
  const secondaryAvailable = isSecondaryDailyAvailable();
  const specialAvailable = isSpecialDailyAvailable();
  const tokens = sg.powerUpTokens;

  const rewardUnit = (type: SecondaryRewardOption["type"]) =>
    type === "coins" ? t("chest.roll.coins") : type === "gems" ? t("chest.roll.gems") : t("chest.roll.power");

  const handleSecondary = (i: 0 | 1 | 2) => {
    const r = claimSecondaryDaily(i);
    if (r.claimed && r.option) {
      refresh();
      startDrop([secondaryToReward(r.option)]);
    }
  };

  const handleSpecial = () => {
    const r = claimSpecialDaily();
    if (r.claimed) refresh();
  };

  const [pickingFor, setPickingFor] = useState(false);
  const [tokenMsg, setTokenMsg] = useState("");
  const handleSpendToken = (brawlerId: string) => {
    const r = consumePowerUpToken(brawlerId);
    if (!r.success) {
      setTokenMsg(`✗ ${r.error}`);
    } else {
      const b = BRAWLERS.find(x => x.id === brawlerId);
      setTokenMsg(t("sg.rewards.tokenUpgraded", { name: b?.name ?? brawlerId, level: r.newLevel ?? 0 }));
      setPickingFor(false);
    }
    setTimeout(() => setTokenMsg(""), 4000);
    refresh();
  };

  const artBase = (import.meta as any).env?.BASE_URL ?? "/";
  const dropOpen = activeDrop && activeDrop.i < activeDrop.q.length;

  return (
    <>
    <div
      className="ui-page-bg"
      style={{
        height: "100%",
        backgroundImage: `url("${(import.meta as any).env?.BASE_URL ?? "/"}constellation-bg.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--app-font-sans)",
        color: "var(--t-1)",
      }}
    >
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 22px",
        borderBottom: "1px solid var(--bd-1)",
        background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 100%)",
        backdropFilter: "blur(10px) saturate(1.15)",
        WebkitBackdropFilter: "blur(10px) saturate(1.15)",
      }}>
        <button onClick={onBack} className="ui-back-btn"><Tr id="drawer.back" /></button>
        <h2 className="ui-page-title" style={{
          flex: 1, fontSize: 22, margin: 0, letterSpacing: "0.12em",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <StarGuardianIcon size={36} />
          <span>STAR GUARDIAN</span>
        </h2>
        <div className="ui-resource-bar">
          <span className="ui-resource-pill ui-resource-pill--gold"><CoinIcon size={20} /> {(profile?.coins ?? 0).toLocaleString("ru-RU")}</span>
          <span className="ui-resource-pill ui-resource-pill--cyan"><GemIcon size={20} /> {(profile?.gems ?? 0).toLocaleString("ru-RU")}</span>
          <span className="ui-resource-pill ui-resource-pill--violet"><PowerIcon size={20} /> {(profile?.powerPoints ?? 0).toLocaleString("ru-RU")}</span>
        </div>
      </div>

      <PageBody style={{ padding: "24px", maxWidth: 880, margin: "0 auto", width: "100%" }}>
        {!active ? (
          <div style={{
            background: "rgba(255,87,34,0.18)",
            border: "1.5px solid rgba(255,87,34,0.6)",
            borderRadius: 14, padding: 20, textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: "#FF8A65" }}>
              <Tr id="sg.rewards.inactiveTitle" />
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              <Tr id="sg.rewards.inactiveDesc" />
            </div>
          </div>
        ) : (
          <>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 18,
              background: "rgba(255,215,64,0.12)",
              border: "1.5px solid rgba(255,215,64,0.5)",
              borderRadius: 12, padding: "10px 16px",
            }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}><Tr id="sg.rewards.daysLeftLabel" /></span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#FFD740" }}><Tr id="sg.rewards.daysLeft" params={{ days: daysLeft }} /></span>
            </div>

            {/* MAIN DAILY */}
            <Card
              title={t("sg.rewards.mainDailyTitle")}
              subtitle={isMainDailyAvailable()
                ? t("sg.rewards.mainCooldownReady")
                : t("sg.rewards.mainCooldown", { time: formatGameDayCountdown(getMsUntilMainDaily()) })}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <RewardChip icon={<CoinIcon size={28} />} amount={MAIN_DAILY_COINS} />
                <RewardChip icon={<GemIcon size={28} />} amount={MAIN_DAILY_GEMS} />
                <RewardChip icon={<PowerIcon size={28} />} amount={MAIN_DAILY_POWER} />
                <div style={{ flex: 1 }} />
                {isMainDailyAvailable() ? (
                  <button type="button" className="no-ui-shear" onClick={handleMainDailyClaim} style={primaryBtn}>
                    <Tr id="common.claim" />
                  </button>
                ) : (
                  <span style={{ color: "#69F0AE", fontWeight: 700, fontSize: 13 }}>
                    {t("sg.rewards.claimedCooldown", { time: formatGameDayCountdown(getMsUntilMainDaily()) })}
                  </span>
                )}
              </div>
            </Card>

            {/* SECONDARY DAILY */}
            <Card title={t("sg.rewards.secondaryTitle")} subtitle={t("sg.rewards.resetAt", { time: formatGameDayCountdown(getMsUntilGameDayReset()) })}>
              {!secondaryAvailable ? (
                <div style={{ color: "#69F0AE", fontWeight: 700, fontSize: 14 }}>
                  <Tr id="sg.rewards.secondaryPickedToday" />
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}>
                  {secondaryOptions.map((opt, i) => (
                    <button key={i} type="button" className="no-ui-shear" onClick={() => handleSecondary(i as 0 | 1 | 2)} style={{
                      background: "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(74,20,140,0.55))",
                      border: "1.5px solid rgba(206,147,216,0.65)",
                      borderRadius: 14, padding: 16,
                      color: "#ffffff", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      transition: "transform 150ms",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-3px)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      {opt.type === "coins"       && <CoinIcon size={48} />}
                      {opt.type === "gems"        && <GemIcon size={48} />}
                      {opt.type === "powerPoints" && <PowerIcon size={48} />}
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD740" }}>+{opt.amount}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        {rewardUnit(opt.type)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* SPECIAL — every 3 days */}
            <Card title={t("sg.rewards.specialTitle")} subtitle={t("sg.rewards.specialSubtitle", { days: SPECIAL_REWARD_INTERVAL_DAYS })}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "radial-gradient(circle at 35% 30%, #FFD740, #B71C1C)",
                  border: "2px solid #FFD740",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, boxShadow: "0 0 18px rgba(255,215,64,0.5)",
                }}><EmojiIcon emoji="⚡" size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}><Tr id="sg.rewards.tokensCount" params={{ count: tokens }} /></div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    <Tr id="sg.rewards.tokenDesc" />
                  </div>
                </div>
                {specialAvailable ? (
                  <button type="button" className="no-ui-shear" onClick={handleSpecial} style={primaryBtn}><Tr id="sg.rewards.claimToken" /></button>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                    {t("sg.rewards.nextSpecial", { time: formatGameDayCountdown(getMsUntilSpecialDaily()) })}
                  </span>
                )}
                {tokens > 0 && (
                  <button
                    type="button"
                    className="no-ui-shear"
                    onClick={() => setPickingFor(v => !v)}
                    style={{
                      background: "linear-gradient(135deg, rgba(123,47,190,0.65), rgba(179,136,255,0.45))",
                      border: "1.5px solid rgba(206,147,216,0.75)",
                      borderRadius: 10, padding: "8px 14px",
                      color: "#ffffff", cursor: "pointer",
                      fontWeight: 700, fontSize: 12,
                      textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                      boxShadow: "0 4px 14px rgba(123,47,190,0.35)",
                    }}>{pickingFor ? t("common.cancel") : t("sg.rewards.apply")}</button>
                )}
              </div>
              {tokenMsg && <div style={{ marginTop: 10, color: tokenMsg.startsWith("✅") ? "#69F0AE" : "#FF8A65", fontWeight: 700 }}>{tokenMsg}</div>}
              {pickingFor && profile && (
                <div style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                  gap: 10,
                }}>
                  {profile.unlockedBrawlers.map(id => {
                    const b = BRAWLERS.find(x => x.id === id);
                    if (!b) return null;
                    const lvl = profile.brawlerLevels[id] || 1;
                    const maxed = lvl >= 11;
                    const avatarBg = RARITY_AVATAR_BG[b.rarity]
                      ?? `linear-gradient(180deg, ${b.color} 0%, rgba(0,0,0,0.6) 100%)`;
                    const displayName = brawlerName(b.id, b.name);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="no-ui-shear"
                        disabled={maxed}
                        onClick={() => handleSpendToken(id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          cursor: maxed ? "not-allowed" : "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          opacity: maxed ? 0.45 : 1,
                        }}
                      >
                        <div style={{
                          width: "100%",
                          aspectRatio: "1 / 1.12",
                          borderRadius: 14,
                          overflow: "hidden",
                          border: `2px solid ${maxed ? "rgba(255,255,255,0.15)" : `${b.color}aa`}`,
                          background: avatarBg,
                          boxShadow: maxed ? "none" : `0 4px 14px ${b.color}44`,
                          position: "relative",
                        }}>
                          <img
                            src={brawlerAvatarUrl(b.id)}
                            alt={displayName}
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              objectPosition: "center top",
                              display: "block",
                              filter: maxed ? "grayscale(0.85)" : "none",
                            }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <span style={{
                          color: maxed ? "rgba(255,255,255,0.4)" : "#ffffff",
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1.15,
                          textAlign: "center",
                          textShadow: "0 1px 3px rgba(0,0,0,0.85)",
                        }}>
                          {displayName}
                        </span>
                        <span style={{
                          color: maxed ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.65)",
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          {t("sg.rewards.levelLine", { level: lvl, suffix: maxed ? t("sg.rewards.maxSuffix") : "" })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <div style={{
              marginTop: 18, padding: 14, fontSize: 12, lineHeight: 1.6,
              background: "rgba(255,255,255,0.04)", borderRadius: 12,
              color: "rgba(255,255,255,0.6)",
            }}>
              <Tr id="sg.rewards.astralNote" />
            </div>
          </>
        )}
      </PageBody>
    </div>
    {dropOpen ? (
      <RewardDropModal
        reward={activeDrop.q[activeDrop.i]}
        onDone={() => {
          setActiveDrop((d) => {
            if (!d) return null;
            const next = d.i + 1;
            if (next >= d.q.length) return null;
            return { q: d.q, i: next };
          });
        }}
      />
    ) : null}
    </>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(74,20,140,0.25))",
      border: "1.5px solid rgba(206,147,216,0.4)",
      borderRadius: 16, padding: 16, marginBottom: 14,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#FFD740" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function RewardChip({ icon, amount }: { icon: React.ReactNode; amount: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "rgba(0,0,0,0.3)", borderRadius: 10,
      padding: "6px 10px",
    }}>
      {icon}
      <span style={{ fontWeight: 800, color: "#FFD740" }}>+{amount}</span>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #FFE57F 0%, #FFD740 48%, #FF8A00 100%)",
  border: "1px solid rgba(255,255,255,0.48)",
  borderRadius: 10,
  padding: "10px 20px",
  fontWeight: 900,
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 13,
  letterSpacing: "0.08em",
  boxShadow: "0 6px 20px rgba(255,160,0,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
  textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
  whiteSpace: "nowrap",
};
