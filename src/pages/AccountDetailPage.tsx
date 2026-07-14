import { useMemo, useRef, useState, useEffect } from "react";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import { PageBg } from "../components/PageChrome";
import { useI18n, brawlerName, modeName } from "../i18n";
import {
  getCurrentProfile,
  getCurrentUsername,
  getBattleHistory,
  deleteLocalAccount,
  isGuestProfile,
  type UserProfile,
} from "../utils/localStorageAPI";
import { changeAccountEmailCloud, changeAccountPasswordCloud } from "../utils/cloud/accountCloud";
import {
  downloadProfileBackupFile,
  getProfileCloudSyncStatus,
  importProfileBackupFromJson,
  PROFILE_CLOUD_CHANGED,
  profileProgressScore,
} from "../utils/cloud/profileCloud";
import { formatPlayerIdDisplay } from "../utils/playerId";
import { BRAWLERS } from "../entities/BrawlerData";
import {
  accountAgeDays,
  buildBattleDayBuckets,
  buildModeRows,
  chestTotal,
  donateSpendingByMonth,
  topBrawlersByTrophies,
  winRate,
} from "../utils/accountStats";
import {
  getAccountPurchaseHistory,
  purchaseCategoryLabel,
  totalDonateRubSpent,
} from "../utils/purchaseHistory";
import { MiniBarChart, MiniDonut, Sparkline, WinLossStackChart } from "../components/account/AccountCharts";
import { getStarGuardianDaysRemaining, isStarGuardianActive } from "../utils/subscription";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

type CategoryId =
  | "overview"
  | "profile"
  | "security"
  | "battles"
  | "statistics"
  | "economy"
  | "collection"
  | "progress"
  | "donations"
  | "settings";

interface Props {
  onBack: () => void;
  onDeleted: () => void;
  onLogout: () => void;
  onOpenAppSettings: () => void;
  onSwitchAccounts: () => void;
  onRegister?: () => void;
}

const CATEGORIES: { id: CategoryId; icon: string; labelKey: string }[] = [
  { id: "overview", icon: "🏠", labelKey: "accounts.cat.overview" },
  { id: "profile", icon: "👤", labelKey: "accounts.cat.profile" },
  { id: "security", icon: "🔐", labelKey: "accounts.cat.security" },
  { id: "battles", icon: "⚔️", labelKey: "accounts.cat.battles" },
  { id: "statistics", icon: "📊", labelKey: "accounts.cat.statistics" },
  { id: "economy", icon: "💰", labelKey: "accounts.cat.economy" },
  { id: "collection", icon: "🎴", labelKey: "accounts.cat.collection" },
  { id: "progress", icon: "🛤️", labelKey: "accounts.cat.progress" },
  { id: "donations", icon: "💎", labelKey: "accounts.cat.donations" },
  { id: "settings", icon: "⚙️", labelKey: "accounts.cat.settings" },
];

export default function AccountDetailPage({
  onBack,
  onDeleted,
  onLogout,
  onOpenAppSettings,
  onSwitchAccounts,
  onRegister,
}: Props) {
  const { t, localeMeta } = useI18n();
  const [profileTick, setProfileTick] = useState(0);
  const profile = useMemo(() => getCurrentProfile(), [profileTick]);
  const username = getCurrentUsername();
  const guest = isGuestProfile(profile);
  const [category, setCategory] = useState<CategoryId>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const history = useMemo(() => getBattleHistory(), []);
  const purchases = useMemo(() => (profile ? getAccountPurchaseHistory(profile) : []), [profile]);
  const dayBuckets = useMemo(
    () => buildBattleDayBuckets(history, 14, localeMeta.bcp47),
    [history, localeMeta.bcp47],
  );
  const modeRows = useMemo(() => (profile ? buildModeRows(profile) : []), [profile]);
  const spendMonths = useMemo(
    () => donateSpendingByMonth(purchases.filter((p) => p.priceRub), 6, localeMeta.bcp47),
    [purchases, localeMeta.bcp47],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!profile || !username) {
    return (
      <PageBg variant="accounts" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 24, textAlign: "center", color: "var(--t-3)" }}><Tr id="accounts.detail.notRegistered" /></div>
      </PageBg>
    );
  }

  return (
    <PageBg variant="accounts" style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--app-font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--bd-1)", flexShrink: 0 }}>
        <button type="button" onClick={onBack} className="ui-back-btn">←</button>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.03em" }}><Tr id="accounts.detail.title" /></div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Sidebar ~25% */}
        <aside
          style={{
            width: "25%",
            minWidth: 200,
            maxWidth: 280,
            borderRight: "1px solid var(--bd-1)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(8,4,24,0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: category === c.id ? "1px solid rgba(255,213,79,0.45)" : "1px solid transparent",
                  background: category === c.id
                    ? "linear-gradient(135deg, rgba(255,213,79,0.18), rgba(120,80,255,0.12))"
                    : "rgba(255,255,255,0.03)",
                  color: category === c.id ? "var(--c-gold-3)" : "var(--t-1)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: category === c.id ? 800 : 600,
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: "center" }}><EmojiIcon emoji={c.icon} size={18} /></span>
                {t(c.labelKey)}
              </button>
            ))}
          </nav>

          {/* Bottom: username + ellipsis */}
          <div
            ref={menuRef}
            style={{
              padding: "12px 10px",
              borderTop: "1px solid var(--bd-1)",
              position: "relative",
              background: "rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profile.username}
                </div>
                {guest && (
                  <div style={{ fontSize: 10, color: "var(--t-3)", marginTop: 2 }}><Tr id="accounts.guestBadge" /></div>
                )}
              </div>
              <button
                type="button"
                aria-label={t("accounts.menu.more")}
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid var(--bd-1)",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--t-1)",
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: "inherit",
                }}
              >
                ⋮
              </button>
            </div>
            {menuOpen && (
              <div
                className="ui-card"
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 8,
                  right: 8,
                  marginBottom: 6,
                  padding: 6,
                  zIndex: 20,
                  boxShadow: "var(--sh-md)",
                }}
              >
                <MenuBtn label={t("accounts.menu.settings")} onClick={() => { setMenuOpen(false); setCategory("settings"); }} />
                <MenuBtn label={t("accounts.menu.appSettings")} onClick={() => { setMenuOpen(false); onOpenAppSettings(); }} />
                <MenuBtn label={t("accounts.menu.logout")} danger onClick={() => { setMenuOpen(false); onLogout(); }} />
              </div>
            )}
          </div>
        </aside>

        {/* Content ~75% */}
        <main style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          <CategoryContent
            category={category}
            profile={profile}
            username={username}
            guest={guest}
            history={history}
            purchases={purchases}
            dayBuckets={dayBuckets}
            modeRows={modeRows}
            spendMonths={spendMonths}
            t={t}
            locale={localeMeta.bcp47}
            onDeleted={onDeleted}
            onSwitchAccounts={onSwitchAccounts}
            onRegister={onRegister}
            onOpenAppSettings={onOpenAppSettings}
            onProfileRefresh={() => setProfileTick((n) => n + 1)}
          />
        </main>
      </div>
    </PageBg>
  );
}

function MenuBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        border: "none",
        borderRadius: 8,
        background: "transparent",
        color: danger ? "#FF8A80" : "var(--t-1)",
        textAlign: "left",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 13,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function CategoryContent({
  category,
  profile,
  username,
  guest,
  history,
  purchases,
  dayBuckets,
  modeRows,
  spendMonths,
  t,
  locale,
  onDeleted,
  onSwitchAccounts,
  onRegister,
  onOpenAppSettings,
  onProfileRefresh,
}: {
  category: CategoryId;
  profile: UserProfile;
  username: string;
  guest: boolean;
  history: ReturnType<typeof getBattleHistory>;
  purchases: ReturnType<typeof getAccountPurchaseHistory>;
  dayBuckets: ReturnType<typeof buildBattleDayBuckets>;
  modeRows: ReturnType<typeof buildModeRows>;
  spendMonths: ReturnType<typeof donateSpendingByMonth>;
  t: (k: string, p?: Record<string, string | number>) => string;
  locale: string;
  onDeleted: () => void;
  onSwitchAccounts: () => void;
  onRegister?: () => void;
  onOpenAppSettings: () => void;
  onProfileRefresh: () => void;
}) {
  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(locale) + " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  if (guest && category === "security") {
    return (
      <GuestPrompt t={t} onRegister={onRegister} message={t("accounts.guest.securityHint")} />
    );
  }

  switch (category) {
    case "overview":
      return (
        <Panel title={t("accounts.cat.overview")} subtitle={t("accounts.cat.overviewSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
            <KpiCard label={t("accounts.kpi.trophies")} value={String(profile.trophies)} color="#FFD54F" />
            <KpiCard label={t("accounts.kpi.winRate")} value={`${winRate(profile)}%`} color="#69F0AE" />
            <KpiCard label={t("accounts.kpi.games")} value={String(profile.totalGamesPlayed)} color="#40C4FF" />
            <KpiCard label={t("accounts.kpi.days")} value={String(accountAgeDays(profile))} color="#CE93D8" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card title={t("accounts.chart.activity14")}>
              <WinLossStackChart data={dayBuckets.map((b) => ({ label: b.label, wins: b.wins, losses: b.losses }))} />
            </Card>
            <Card title={t("accounts.chart.trophyTrend")}>
              <Sparkline points={dayBuckets.map((b) => b.trophies)} width={260} height={56} color="#FFD54F" />
              <div style={{ fontSize: 11, color: "var(--t-3)", marginTop: 8 }}><Tr id="accounts.chart.trophyTrendHint" /></div>
            </Card>
          </div>
          <Card title={t("accounts.detail.info")} style={{ marginTop: 14 }}>
            <DataTable rows={[
              [t("auth.username"), profile.username],
              ["ID", profile.playerId ? formatPlayerIdDisplay(profile.playerId) : "—"],
              [t("accounts.email"), profile.email || "—"],
              [t("accounts.detail.created"), formatTs(profile.createdAt)],
            ]} />
          </Card>
        </Panel>
      );

    case "profile":
      return (
        <Panel title={t("accounts.cat.profile")} subtitle={t("accounts.cat.profileSub")}>
          <Card>
            <DataTable rows={[
              [t("auth.username"), profile.username],
              ["ID", profile.playerId ? formatPlayerIdDisplay(profile.playerId) : "—"],
              [t("accounts.email"), profile.email || "—"],
              [t("accounts.profile.control"), profile.controlMode === "pc" ? t("settings.controls.pc") : t("settings.controls.mobile")],
              [t("accounts.profile.favorite"), brawlerName(profile.favoriteBrawlerId, BRAWLERS.find((b) => b.id === profile.favoriteBrawlerId)?.name ?? profile.favoriteBrawlerId)],
              [t("accounts.profile.xp"), String(profile.xp)],
              [t("accounts.detail.created"), formatTs(profile.createdAt)],
            ]} />
          </Card>
          <Card title={t("accounts.profile.resources")} style={{ marginTop: 14 }}>
            <MiniDonut segments={[
              { label: t("settings.profile.coins", { count: profile.coins }), value: Math.max(profile.coins, 1), color: "#FFD54F" },
              { label: t("settings.profile.gems", { count: profile.gems }), value: Math.max(profile.gems, 1), color: "#40C4FF" },
              { label: t("settings.profile.power", { count: profile.powerPoints }), value: Math.max(profile.powerPoints, 1), color: "#CE93D8" },
            ]} />
          </Card>
        </Panel>
      );

    case "security":
      return <SecurityPanel t={t} formatTs={formatTs} profile={profile} username={username} onDeleted={onDeleted} onProfileRefresh={onProfileRefresh} />;

    case "battles":
      return (
        <Panel title={t("accounts.cat.battles")} subtitle={t("accounts.cat.battlesSub")}>
          <Card title={t("accounts.chart.activity14")}>
            <WinLossStackChart data={dayBuckets.map((b) => ({ label: b.label, wins: b.wins, losses: b.losses }))} height={140} />
          </Card>
          {!history.length ? (
            <Empty text={t("drawer.battles.empty")} />
          ) : (
            <Card title={t("accounts.battles.recent")} style={{ marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--t-3)", textAlign: "left" }}>
                    <th style={thStyle}><Tr id="accounts.table.date" /></th>
                    <th style={thStyle}><Tr id="accounts.table.result" /></th>
                    <th style={thStyle}><Tr id="drawer.battle.mode" /></th>
                    <th style={thStyle}><Tr id="drawer.battle.brawler" /></th>
                    <th style={thStyle}><EmojiIcon emoji="🏆" size={24} /></th>
                    <th style={thStyle}>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 25).map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--bd-1)" }}>
                      <td style={tdStyle}>{formatTs(r.ts)}</td>
                      <td style={{ ...tdStyle, color: r.won ? "#69F0AE" : "#FF5252", fontWeight: 800 }}>
                        {r.won ? t("drawer.battle.win") : t("drawer.battle.loss")}
                      </td>
                      <td style={tdStyle}>{modeName(r.mode, r.mode)}</td>
                      <td style={tdStyle}>{brawlerName(r.brawlerId, BRAWLERS.find((b) => b.id === r.brawlerId)?.name ?? r.brawlerId)}</td>
                      <td style={tdStyle}>{r.trophyDelta >= 0 ? "+" : ""}{r.trophyDelta}</td>
                      <td style={tdStyle}>+{r.xpGained}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Panel>
      );

    case "statistics":
      return (
        <Panel title={t("accounts.cat.statistics")} subtitle={t("accounts.cat.statisticsSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card title={t("accounts.stats.summary")}>
              <DataTable rows={[
                [t("settings.profile.wins", { wins: profile.totalWins, games: profile.totalGamesPlayed }), `${winRate(profile)}%`],
                [t("accounts.stats.losses"), String(profile.totalLosses)],
                [t("accounts.kpi.trophies"), String(profile.trophies)],
                [t("accounts.profile.xp"), String(profile.xp)],
              ]} />
            </Card>
            <Card title={t("accounts.stats.winLoss")}>
              <MiniDonut segments={[
                { label: t("drawer.battle.win"), value: Math.max(profile.totalWins, 1), color: "#69F0AE" },
                { label: t("drawer.battle.loss"), value: Math.max(profile.totalLosses, 1), color: "#FF5252" },
              ]} />
            </Card>
          </div>
          <Card title={t("accounts.stats.byMode")} style={{ marginTop: 14 }}>
            {modeRows.length ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--t-3)", textAlign: "left" }}>
                    <th style={thStyle}><Tr id="drawer.battle.mode" /></th>
                    <th style={thStyle}><Tr id="accounts.table.games" /></th>
                    <th style={thStyle}><Tr id="accounts.table.wins" /></th>
                    <th style={thStyle}><Tr id="accounts.table.winRate" /></th>
                  </tr>
                </thead>
                <tbody>
                  {modeRows.map((m) => (
                    <tr key={m.mode} style={{ borderTop: "1px solid var(--bd-1)" }}>
                      <td style={tdStyle}>{modeName(m.mode, m.mode)}</td>
                      <td style={tdStyle}>{m.games}</td>
                      <td style={tdStyle}>{m.wins}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <VolProgressTrack
                            fitHeight={12}
                            fill={m.winRate}
                            fillBackground="#69F0AE"
                            style={{ flex: 1 }}
                          />
                          {m.winRate}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text={t("accounts.stats.noModes")} />
            )}
          </Card>
          <Card title={t("accounts.stats.topBrawlers")} style={{ marginTop: 14 }}>
            <MiniBarChart
              data={topBrawlersByTrophies(profile).map((b) => ({
                label: brawlerName(b.id, BRAWLERS.find((x) => x.id === b.id)?.name ?? b.id).slice(0, 6),
                value: b.trophies,
                color: "linear-gradient(180deg, #40C4FF, #1565C0)",
              }))}
            />
          </Card>
        </Panel>
      );

    case "economy":
      return (
        <Panel title={t("accounts.cat.economy")} subtitle={t("accounts.cat.economySub")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
            <KpiCard label="🪙" value={String(profile.coins)} color="#FFD54F" />
            <KpiCard label="💎" value={String(profile.gems)} color="#40C4FF" />
            <KpiCard label="⚡" value={String(profile.powerPoints)} color="#CE93D8" />
          </div>
          <Card title={t("accounts.economy.chests")}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--t-3)", textAlign: "left" }}>
                  <th style={thStyle}><Tr id="accounts.table.rarity" /></th>
                  <th style={thStyle}><Tr id="accounts.table.count" /></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(profile.chestInventory ?? {}).map(([r, n]) => (
                  <tr key={r} style={{ borderTop: "1px solid var(--bd-1)" }}>
                    <td style={tdStyle}>{r}</td>
                    <td style={tdStyle}>{n || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--t-3)" }}>
              <Tr id="accounts.economy.chestTotal" params={{ count: chestTotal(profile) }} />
            </div>
          </Card>
          <Card title={t("accounts.economy.donateTotal")} style={{ marginTop: 14 }}>
            <KpiCard label={t("accounts.economy.spentRub")} value={`${totalDonateRubSpent(purchases)} ₽`} color="#E91E63" wide />
          </Card>
        </Panel>
      );

    case "collection":
      return (
        <Panel title={t("accounts.cat.collection")} subtitle={t("accounts.cat.collectionSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
            <KpiCard label={t("accounts.collection.brawlers")} value={String(profile.unlockedBrawlers?.length ?? 0)} color="#FFD54F" />
            <KpiCard label={t("accounts.collection.pets")} value={String(profile.unlockedPets?.length ?? 0)} color="#69F0AE" />
            <KpiCard label={t("accounts.collection.pins")} value={String(profile.ownedPins?.length ?? 0)} color="#40C4FF" />
            <KpiCard label={t("accounts.collection.icons")} value={String(profile.unlockedProfileIcons?.length ?? 0)} color="#CE93D8" />
          </div>
          <Card title={t("accounts.collection.brawlerLevels")}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--t-3)", textAlign: "left" }}>
                  <th style={thStyle}><Tr id="drawer.battle.brawler" /></th>
                  <th style={thStyle}>Lv</th>
                  <th style={thStyle}><EmojiIcon emoji="🏆" size={24} /></th>
                  <th style={thStyle}>⭐</th>
                </tr>
              </thead>
              <tbody>
                {topBrawlersByTrophies(profile, 12).map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid var(--bd-1)" }}>
                    <td style={tdStyle}>{brawlerName(b.id, BRAWLERS.find((x) => x.id === b.id)?.name ?? b.id)}</td>
                    <td style={tdStyle}>{b.level}</td>
                    <td style={tdStyle}>{b.trophies}</td>
                    <td style={tdStyle}>{profile.brawlerStars?.[b.id]?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Panel>
      );

    case "progress":
      return (
        <Panel title={t("accounts.cat.progress")} subtitle={t("accounts.cat.progressSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card title="Star Pass">
              <DataTable rows={[
                [t("accounts.progress.level"), String(profile.clashPassLevel)],
                [t("accounts.progress.paid"), profile.clashPassPaid ? t("common.yes") : t("common.no")],
                [t("accounts.progress.ultra"), profile.clashPassUltraPaid ? t("common.yes") : t("common.no")],
                [t("accounts.progress.claimed"), String(profile.clashPassClaimed?.length ?? 0)],
              ]} />
              <MiniBarChart
                data={[
                  { label: "Free", value: profile.clashPassClaimed?.length ?? 0, color: "#69F0AE" },
                  { label: "Paid", value: profile.clashPassClaimedPaid?.length ?? 0, color: "#FFD54F" },
                  { label: "Ultra", value: profile.clashPassClaimedUltra?.length ?? 0, color: "#E91E63" },
                ]}
                height={90}
              />
            </Card>
            <Card title={t("accounts.progress.other")}>
              <DataTable rows={[
                [t("accounts.progress.trophyRoad"), String(profile.trophyRoadClaimed?.length ?? 0)],
                [t("accounts.progress.dailyLadder"), String(profile.dailyLadderDay ?? 1)],
                [t("accounts.progress.quests"), String(profile.questPool?.activeQuests?.length ?? profile.dailyQuests?.quests?.length ?? 0)],
                [t("accounts.progress.starGuardian"), isStarGuardianActive() ? t("accounts.progress.activeDays", { days: getStarGuardianDaysRemaining() }) : t("accounts.progress.inactive")],
              ]} />
            </Card>
          </div>
          {profile.bossRaid?.byBoss && Object.keys(profile.bossRaid.byBoss).length > 0 && (
            <Card title={t("accounts.progress.bossRaid")} style={{ marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--t-3)", textAlign: "left" }}>
                    <th style={thStyle}>Boss</th>
                    <th style={thStyle}><Tr id="accounts.progress.maxLevel" /></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(profile.bossRaid.byBoss).map(([id, v]) => (
                    <tr key={id} style={{ borderTop: "1px solid var(--bd-1)" }}>
                      <td style={tdStyle}>{id}</td>
                      <td style={tdStyle}>{v.maxDefeated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Panel>
      );

    case "donations":
      return (
        <Panel title={t("accounts.cat.donations")} subtitle={t("accounts.cat.donationsSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <KpiCard label={t("accounts.economy.spentRub")} value={`${totalDonateRubSpent(purchases)} ₽`} color="#E91E63" wide />
            <KpiCard label={t("accounts.donate.count")} value={String(purchases.length)} color="#FFD54F" wide />
          </div>
          <Card title={t("accounts.donate.chart")}>
            <MiniBarChart
              data={spendMonths.map((m) => ({ label: m.label, value: m.rub, color: "linear-gradient(180deg, #F48FB1, #E91E63)" }))}
              valueSuffix="₽"
              height={130}
            />
          </Card>
          <Card title={t("accounts.donate.history")} style={{ marginTop: 14 }}>
            {!purchases.length ? (
              <Empty text={t("accounts.donate.empty")} />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--t-3)", textAlign: "left" }}>
                    <th style={thStyle}><Tr id="accounts.table.date" /></th>
                    <th style={thStyle}><Tr id="accounts.table.item" /></th>
                    <th style={thStyle}><Tr id="accounts.table.type" /></th>
                    <th style={thStyle}><Tr id="accounts.table.price" /></th>
                    <th style={thStyle}><Tr id="accounts.table.reward" /></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--bd-1)" }}>
                      <td style={tdStyle}>{formatTs(p.ts)}</td>
                      <td style={tdStyle}>{p.title}</td>
                      <td style={tdStyle}>{purchaseCategoryLabel(p.category, t)}</td>
                      <td style={tdStyle}>{p.priceRub ? `${p.priceRub} ₽` : p.gemsSpent ? <><>{p.gemsSpent}</> <EmojiIcon emoji="💎" size={24} /></> : "—"}</td>
                      <td style={tdStyle}>{p.rewardSummary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </Panel>
      );

    case "settings":
      return (
        <Panel title={t("accounts.cat.settings")} subtitle={t("accounts.cat.settingsSub")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={onSwitchAccounts}>
              <Tr id="settings.switchAccount" />
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={onOpenAppSettings}>
              <Tr id="drawer.settings" />
            </button>
            {guest && onRegister && (
              <button type="button" className="ui-btn ui-btn--primary ui-btn--block" onClick={onRegister}>
                <Tr id="accounts.registerGuest" />
              </button>
            )}
          </div>
          {!guest && (
            <SecurityPanel t={t} formatTs={formatTs} profile={profile} username={username} onDeleted={onDeleted} onProfileRefresh={onProfileRefresh} compact />
          )}
        </Panel>
      );

    default:
      return null;
  }
}

function CloudSaveCard({
  t,
  profile,
  flash,
}: {
  t: (k: string, p?: Record<string, string | number>) => string;
  profile: UserProfile;
  flash: (text: string) => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [syncStatus, setSyncStatus] = useState(() => getProfileCloudSyncStatus());

  useEffect(() => {
    const refresh = () => setSyncStatus(getProfileCloudSyncStatus());
    refresh();
    const id = window.setInterval(refresh, 1000);
    window.addEventListener(PROFILE_CLOUD_CHANGED, refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(PROFILE_CLOUD_CHANGED, refresh);
    };
  }, []);

  const lastSyncLabel =
    syncStatus.lastOkAt > 0
      ? new Date(syncStatus.lastOkAt).toLocaleTimeString()
      : t("accounts.cloudSave.never");

  return (
    <Card title={t("accounts.cloudSave.title")} style={{ marginBottom: 14 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--t-3)", lineHeight: 1.45 }}>
        <Tr id="accounts.cloudSave.autoSub" />
      </p>
      <div style={{ fontSize: 12, color: "var(--t-2)", marginBottom: 10, lineHeight: 1.6 }}>
        {t("accounts.cloudSave.stats", {
          coins: profile.coins,
          trophies: profile.trophies,
          games: profile.totalGamesPlayed ?? 0,
        })}
      </div>
      <div
        style={{
          fontSize: 12,
          marginBottom: 12,
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${syncStatus.error ? "rgba(255,82,82,0.45)" : "rgba(105,240,174,0.35)"}`,
          background: syncStatus.error
            ? "rgba(255,82,82,0.08)"
            : "rgba(105,240,174,0.08)",
          color: syncStatus.error ? "#ff8a80" : "#69F0AE",
          lineHeight: 1.5,
        }}
      >
        {syncStatus.error
          ? t("accounts.cloudSave.error", { msg: syncStatus.error })
          : syncStatus.active
            ? t("accounts.cloudSave.active", { time: lastSyncLabel })
            : t("accounts.cloudSave.inactive")}
        {syncStatus.pending ? ` · ${t("accounts.cloudSave.pending")}` : ""}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={() => {
            const ok = downloadProfileBackupFile();
            flash(ok ? t("accounts.cloudSave.backupOk") : t("common.error"));
          }}
        >
          <Tr id="accounts.cloudSave.backup" />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={() => importRef.current?.click()}
        >
          <Tr id="accounts.cloudSave.import" />
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = typeof reader.result === "string" ? reader.result : "";
              const r = importProfileBackupFromJson(text);
              if (r.success) {
                flash(t("accounts.cloudSave.importOk", { name: r.username ?? "" }));
                window.location.reload();
              } else {
                flash(r.error || t("common.error"));
              }
            };
            reader.readAsText(file);
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--t-3)", marginTop: 10 }}>
        score: {profileProgressScore(profile)}
      </div>
    </Card>
  );
}

function SecurityPanel({
  t,
  formatTs,
  profile,
  username,
  onDeleted,
  onProfileRefresh,
  compact,
}: {
  t: (k: string) => string;
  formatTs: (ts: number) => string;
  profile: UserProfile;
  username: string;
  onDeleted: () => void;
  onProfileRefresh: () => void;
  compact?: boolean;
}) {
  const [email, setEmail] = useState(profile.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEmail(profile.email ?? "");
  }, [profile.email]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <Panel title={compact ? undefined : t("accounts.cat.security")} subtitle={compact ? undefined : t("accounts.cat.securitySub")}>
      {!compact && (
        <CloudSaveCard t={t} profile={profile} flash={flash} />
      )}
      {!compact && (
        <Card title={t("accounts.email")}>
          <input className="ui-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("accounts.emailPlaceholder")} style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
          <button type="button" onClick={() => {
            void changeAccountEmailCloud(email).then((r) => {
              if (r.success) onProfileRefresh();
              flash(r.success ? t("accounts.detail.emailSaved") : (r.error || t("common.error")));
            });
          }} className="ui-btn ui-btn--primary"><Tr id="accounts.detail.saveEmail" /></button>
        </Card>
      )}
      {!compact && (
        <Card title={t("accounts.detail.password")} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="ui-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t("accounts.detail.currentPassword")} />
            <input className="ui-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("accounts.detail.newPassword")} />
            <input className="ui-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("accounts.register.confirmPassword")} />
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => {
              if (newPassword !== confirmPassword) { flash(t("accounts.register.passwordMismatch")); return; }
              void changeAccountPasswordCloud(currentPassword, newPassword).then((r) => {
                if (r.success) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
                flash(r.success ? t("accounts.detail.passwordSaved") : (r.error || t("common.error")));
              });
            }}><Tr id="accounts.detail.savePassword" /></button>
          </div>
        </Card>
      )}
      <Card title={t("accounts.detail.danger")} style={{ marginTop: compact ? 0 : 14 }}>
        <button type="button" onClick={() => {
          if (!confirmDelete) { setConfirmDelete(true); return; }
          const r = deleteLocalAccount(username);
          if (r.success) onDeleted();
          else flash(r.error || t("common.error"));
        }} className="ui-btn ui-btn--block" style={{ background: confirmDelete ? "rgba(255,23,68,0.35)" : "rgba(255,82,82,0.12)", border: "1px solid rgba(255,82,82,0.45)", color: "#FF8A80", fontWeight: 800 }}>
          {confirmDelete ? t("accounts.detail.confirmDelete") : t("accounts.detail.delete")}
        </button>
        {confirmDelete && (
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" style={{ marginTop: 8 }} onClick={() => setConfirmDelete(false)}>
            <Tr id="common.cancel" />
          </button>
        )}
      </Card>
      {msg && <div className="ui-glass" style={{ marginTop: 12, padding: 10, textAlign: "center", color: "#69F0AE", fontWeight: 700 }}>{msg}</div>}
    </Panel>
  );
}

function GuestPrompt({ t, onRegister, message }: { t: (k: string) => string; onRegister?: () => void; message: string }) {
  return (
    <div className="ui-card" style={{ padding: 28, textAlign: "center", maxWidth: 420 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}><EmojiIcon emoji="📝" size={24} /></div>
      <p style={{ margin: "0 0 16px", color: "var(--t-3)", lineHeight: 1.5 }}>{message}</p>
      {onRegister && (
        <button type="button" className="ui-btn ui-btn--primary" onClick={onRegister}><Tr id="accounts.registerGuest" /></button>
      )}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      {title && <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900 }}>{title}</h2>}
      {subtitle && <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--t-3)", lineHeight: 1.45 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ui-card" style={{ padding: 16, ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: "var(--c-gold-3)", letterSpacing: "0.04em" }}>{title.toUpperCase()}</div>}
      {children}
    </div>
  );
}

function KpiCard({ label, value, color, wide }: { label: string; value: string; color: string; wide?: boolean }) {
  return (
    <div className="ui-card" style={{
      padding: "14px 16px",
      background: `linear-gradient(160deg, ${color}22, rgba(8,4,24,0.78))`,
      border: `1px solid ${color}55`,
      gridColumn: wide ? "span 2" : undefined,
    }}>
      <div style={{ fontSize: 11, color: "var(--t-3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function DataTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} style={{ borderTop: "1px solid var(--bd-1)" }}>
            <td style={{ padding: "8px 0", color: "var(--t-3)", width: "45%" }}>{k}</td>
            <td style={{ padding: "8px 0", fontWeight: 700, textAlign: "right" }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 24, textAlign: "center", color: "var(--t-3)", fontSize: 13 }}>{text}</div>;
}

const thStyle: React.CSSProperties = { padding: "8px 6px", fontWeight: 700 };
const tdStyle: React.CSSProperties = { padding: "8px 6px" };
