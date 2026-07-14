import { useEffect, useMemo, useState } from "react";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import ClubAvatar from "../components/ClubAvatar";
import { TrophyIcon } from "../components/GameIcons";
import { BRAWLERS } from "../entities/BrawlerData";
import { useI18n, brawlerName } from "../i18n";
import { brawlerAvatarUrl } from "../utils/modeAssets";
import { formatPlayerIdDisplay } from "../utils/playerId";
import { getProfileIconImage } from "../utils/profileIconUtils";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";
import {
  getBrawlerTrophyRecords,
  getClubRecords,
  getGlobalTrophyRecords,
  type BrawlerRecordEntry,
  type ClubRecordSort,
  type GlobalRecordEntry,
  type RecordCategory,
} from "../utils/records";
import {
  fetchBrawlerRecordsCloud,
  fetchGlobalRecordsCloud,
  invalidateRecordsCloud,
  isRecordsCloudEnabled,
} from "../utils/cloud/recordsCloud";

interface Props {
  onBack: () => void;
  onViewProfile: (playerId: string) => void;
  onViewClub: (clubId: string) => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const base = (import.meta as any).env?.BASE_URL ?? "/";

function rankAccent(rank: number): { bg: string; border: string } {
  if (rank === 1) return { bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.35)" };
  if (rank === 2) return { bg: "rgba(192,192,192,0.1)", border: "rgba(192,192,192,0.3)" };
  if (rank === 3) return { bg: "rgba(205,127,50,0.1)", border: "rgba(205,127,50,0.3)" };
  return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" };
}

function PlayerAvatar({
  profileIconId,
  username,
  size = 44,
}: {
  profileIconId?: string;
  username: string;
  size?: number;
}) {
  const src = profileIconId
    ? getProfileIconImage(profileIconId, base)
    : brawlerAvatarUrl("miya");
  return (
    <img
      src={src}
      alt={username}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid rgba(255,255,255,0.25)",
        flexShrink: 0,
      }}
    />
  );
}

function TabButton({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 14,
        border: active ? "2px solid rgba(255,213,79,0.55)" : "1px solid rgba(255,255,255,0.1)",
        background: active
          ? "linear-gradient(135deg, rgba(255,213,79,0.18), rgba(255,143,0,0.12))"
          : "rgba(0,0,0,0.25)",
        color: "white",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: active ? "0 0 18px rgba(255,179,0,0.25)" : "none",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900 }}>{label}</div>
      {sub ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{sub}</div>
      ) : null}
    </button>
  );
}

export default function RecordsPage({ onBack, onViewProfile, onViewClub }: Props) {
  const { t } = useI18n();
  const [category, setCategory] = useState<RecordCategory>("global");
  const [selectedBrawlerId, setSelectedBrawlerId] = useState(BRAWLERS[0]?.id ?? "miya");
  const [clubSort, setClubSort] = useState<ClubRecordSort>("trophies");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = () => { invalidateRecordsCloud(); setRefreshKey((k) => k + 1); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Local aggregation renders instantly; the global Supabase ladder (built from
  // every account's synced profile) replaces it as soon as it loads.
  const [globalRecords, setGlobalRecords] = useState<GlobalRecordEntry[]>(() => getGlobalTrophyRecords());
  const [brawlerRecords, setBrawlerRecords] = useState<BrawlerRecordEntry[]>(() =>
    getBrawlerTrophyRecords(selectedBrawlerId),
  );

  useEffect(() => {
    setGlobalRecords(getGlobalTrophyRecords());
    if (!isRecordsCloudEnabled()) return;
    let alive = true;
    void fetchGlobalRecordsCloud().then((rows) => { if (alive && rows.length) setGlobalRecords(rows); });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    setBrawlerRecords(getBrawlerTrophyRecords(selectedBrawlerId));
    if (!isRecordsCloudEnabled()) return;
    let alive = true;
    void fetchBrawlerRecordsCloud(selectedBrawlerId).then((rows) => { if (alive && rows.length) setBrawlerRecords(rows); });
    return () => { alive = false; };
  }, [selectedBrawlerId, refreshKey]);

  const clubRecords = useMemo(() => getClubRecords(clubSort), [clubSort, refreshKey]);

  const selectedBrawler = BRAWLERS.find((b) => b.id === selectedBrawlerId) ?? BRAWLERS[0];

  return (
    <PageBg variant="records" style={{ fontFamily: "var(--app-font-sans)" }}>
      <PageHeader onBack={onBack} title={<> <EmojiIcon emoji="🏆" size={20} /> <Tr id="records.title" /></>} />
      <PageBody
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 14,
          padding: "8px 14px 20px",
          overflow: "hidden",
        }}
      >
        <aside
          style={{
            width: 300,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 0,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            padding: 12,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.45)" }}>
            <Tr id="records.categories" />
          </div>
          <TabButton
            active={category === "global"}
            label={t("records.tab.global")}
            sub={t("records.tab.global.sub")}
            onClick={() => setCategory("global")}
          />
          <TabButton
            active={category === "brawler"}
            label={t("records.tab.brawler")}
            sub={t("records.tab.brawler.sub")}
            onClick={() => setCategory("brawler")}
          />
          <TabButton
            active={category === "club"}
            label={t("records.tab.club")}
            sub={t("records.tab.club.sub")}
            onClick={() => setCategory("club")}
          />

          {category === "brawler" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.45)" }}>
                <Tr id="records.pickBrawler" />
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  paddingRight: 2,
                }}
              >
                {BRAWLERS.map((b) => {
                  const active = b.id === selectedBrawlerId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={brawlerName(b.id, b.name)}
                      onClick={() => setSelectedBrawlerId(b.id)}
                      style={{
                        padding: 6,
                        borderRadius: 12,
                        border: active ? `2px solid ${b.color}` : "1px solid rgba(255,255,255,0.12)",
                        background: active ? `${b.color}22` : "rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <img
                        src={brawlerAvatarUrl(b.id)}
                        alt=""
                        style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.85)",
                          textAlign: "center",
                          lineHeight: 1.2,
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {brawlerName(b.id, b.name)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {category === "club" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.45)" }}>
                <Tr id="records.clubSort" />
              </div>
              <TabButton
                active={clubSort === "trophies"}
                label={t("records.clubSort.trophies")}
                onClick={() => setClubSort("trophies")}
              />
              <TabButton
                active={clubSort === "members"}
                label={t("records.clubSort.members")}
                onClick={() => setClubSort("members")}
              />
            </div>
          )}
        </aside>

        <section
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,0,0,0.32)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            padding: "14px 16px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "white" }}>
              {category === "global" && t("records.panel.global")}
              {category === "brawler" &&
                t("records.panel.brawler", { name: brawlerName(selectedBrawler.id, selectedBrawler.name) })}
              {category === "club" &&
                (clubSort === "members" ? t("records.panel.clubMembers") : t("records.panel.clubTrophies"))}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              {category === "global" && t("records.panel.global.sub", { count: globalRecords.length })}
              {category === "brawler" && t("records.panel.brawler.sub", { count: brawlerRecords.length })}
              {category === "club" && t("records.panel.club.sub", { count: clubRecords.length })}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {category === "global" && (
              globalRecords.length ? (
                globalRecords.map((row) => {
                  const accent = rankAccent(row.rank);
                  return (
                    <button
                      key={row.username}
                      type="button"
                      onClick={() => onViewProfile(row.playerId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: `1px solid ${accent.border}`,
                        background: accent.bg,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "white",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ width: 32, textAlign: "center", fontSize: 18, fontWeight: 900 }}>
                        {MEDALS[row.rank - 1] ? (
                          <EmojiIcon emoji={MEDALS[row.rank - 1]} size={22} />
                        ) : (
                          `#${row.rank}`
                        )}
                      </span>
                      <PlayerAvatar profileIconId={row.profileIconId} username={row.username} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{row.username}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                          {formatPlayerIdDisplay(row.playerId)} · <Tr id="records.gamesWins" params={{ games: row.totalGames, wins: row.totalWins }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD700", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <TrophyIcon size={14} lite /> {row.trophies}
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyState text={t("records.empty.global")} />
              )
            )}

            {category === "brawler" && (
              brawlerRecords.length ? (
                brawlerRecords.map((row) => {
                  const accent = rankAccent(row.rank);
                  return (
                    <button
                      key={row.username}
                      type="button"
                      onClick={() => onViewProfile(row.playerId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: `1px solid ${accent.border}`,
                        background: accent.bg,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "white",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ width: 32, textAlign: "center", fontSize: 18, fontWeight: 900 }}>
                        {MEDALS[row.rank - 1] ? (
                          <EmojiIcon emoji={MEDALS[row.rank - 1]} size={22} />
                        ) : (
                          `#${row.rank}`
                        )}
                      </span>
                      <PlayerAvatar profileIconId={row.profileIconId} username={row.username} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{row.username}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                          {formatPlayerIdDisplay(row.playerId)}
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD700", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <TrophyIcon size={14} lite /> {row.brawlerTrophies}
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyState text={t("records.empty.brawler")} />
              )
            )}

            {category === "club" && (
              clubRecords.length ? (
                clubRecords.map((row) => {
                  const accent = rankAccent(row.rank);
                  return (
                    <button
                      key={row.club.id}
                      type="button"
                      onClick={() => onViewClub(row.club.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: `1px solid ${accent.border}`,
                        background: accent.bg,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "white",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ width: 32, textAlign: "center", fontSize: 18, fontWeight: 900 }}>
                        {MEDALS[row.rank - 1] ? (
                          <EmojiIcon emoji={MEDALS[row.rank - 1]} size={22} />
                        ) : (
                          `#${row.rank}`
                        )}
                      </span>
                      <ClubAvatar club={row.club} size={48} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{row.club.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                          <Tr id="records.clubMeta" params={{ members: row.memberCount, trophies: row.totalTrophies }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD700", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <TrophyIcon size={14} lite /> {row.totalTrophies}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                          <EmojiIcon emoji="👥" size={18} /> {row.memberCount}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyState text={t("records.empty.club")} />
              )
            )}
          </div>
        </section>
      </PageBody>
    </PageBg>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.45)" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}><EmojiIcon emoji="🏆" size={24} /></div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}
