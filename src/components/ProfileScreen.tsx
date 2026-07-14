import { useMemo, useState, type CSSProperties } from "react";
import type { UserProfile } from "../utils/localStorageAPI";
import {
  getCurrentProfile,
  setFavoriteBrawler,
  setFavoritePin,
  getFavoritePinId,
  getOwnedPins,
  getIntroDisplayIconIds,
  setIntroDisplayIcon,
  renamePlayer,
  setUsernameColor,
  RENAME_GEM_COST,
  getBrawlerTrophies,
  getBrawlerRank,
  setEquippedMasteryTitle,
  setEquippedPortraitBackground,
} from "../utils/localStorageAPI";
import { PORTRAIT_BACKGROUNDS } from "../data/portraitBackgrounds";
import {
  getEquippedPortraitBackgroundId,
  getPortraitBackgroundThumbSrc,
  isPortraitBackgroundUnlocked,
} from "../utils/portraitBackgroundUtils";
import {
  getMasteryDisplayKind,
  getMasteryLevel,
  getMasteryTier,
  getMasteryTierLevel,
  MAX_MASTERY_LEVEL,
  BRAWLER_MASTERY_TITLES,
  masteryTitleId,
} from "../data/brawlerMastery";
import { getBrawlerMasteryXp } from "../utils/brawlerMasteryStorage";
import { getMasteryBadgeSrc } from "../utils/brawlerMasteryUI";
import PlayerMasteryTitle from "./PlayerMasteryTitle";
import PinIcon from "./PinIcon";
import { sortOwnedPinIds, pinIdFor } from "../entities/PinData";
import { BRAWLERS } from "../entities/BrawlerData";
import { getBrawlerDisplayName } from "../utils/brawlerDisplay";
import { brawlerAvatarUrl } from "../utils/modeAssets";
import { RankBadgeIcon } from "./BrawlerRankBar";
import { computeBrawlerRankBarState } from "../utils/brawlerRankUI";
import ProfileIconPicker from "./ProfileIconPicker";
import ProfileFavoriteBrawlerCard from "./profile/ProfileFavoriteBrawlerCard";
import { TrophyIcon, GemIcon } from "./GameIcons";
import { isStarGuardianActive, getStarGuardianDaysRemaining } from "../utils/subscription";
import UsernameDisplay from "./UsernameDisplay";
import { SUBSCRIBER_NAME_COLORS } from "../data/subscriberNameColors";
import { PageBg, PageBody, PageHeader } from "./PageChrome";
import { PROFILE_NAME_COLORS, DEFAULT_PROFILE_ICON_ID } from "../data/profileIcons";
import { getProfileIconImage } from "../utils/profileIconUtils";
import { copyPlayerIdToClipboard, formatPlayerIdDisplay } from "../utils/playerId";
import { getClub, getMyClub } from "../utils/clubs";
import ClubAvatar from "./ClubAvatar";
import { getBestWinStreakRecord, isWinStreakVisible } from "../utils/winStreak";
import {
  bestBrawlerRankedRank,
  getProfileRankedCups,
  getProfileRankedPeakCups,
  rankedLeagueIconUrl,
  rankedStandingFromTotalCups,
  RANKED_LEAGUES,
  tierRoman,
  type RankedStanding,
} from "../utils/rankedProgress";
import WinStreakFlame from "./WinStreakFlame";
import { useI18n } from "../i18n";
import { starFeatBadgeImg } from "../data/starFeatsData";
import { getDisplayStarFeatTierBadges } from "../utils/starFeatDisplay";
import { EmojiIcon, TextWithEmojis } from "./EmojiIcon";
import { Tr  } from "../i18n/Tr";
import {
  getFriendshipTitleForViewer,
  getProfileFriendshipTitles,
} from "../utils/social/friendship";

const RANKS_PER_ROW = 5;

export interface ProfileScreenProps {
  profile: UserProfile;
  readOnly?: boolean;
  headerTitle?: string;
  onBack: () => void;
  onViewClub?: (clubId: string) => void;
  onProfileChange?: () => void;
}

export default function ProfileScreen({
  profile,
  readOnly = false,
  headerTitle,
  onBack,
  onViewClub,
  onProfileChange,
}: ProfileScreenProps) {
  const { t } = useI18n();
  const title = headerTitle ?? t("profile.title");
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [introIconPickerSlot, setIntroIconPickerSlot] = useState<0 | 1 | null>(null);
  const [favPickerOpen, setFavPickerOpen] = useState(false);
  const [favPinPickerOpen, setFavPinPickerOpen] = useState(false);
  const [favBgPickerOpen, setFavBgPickerOpen] = useState(false);
  const [ranksExpanded, setRanksExpanded] = useState(true);
  const [masteryExpanded, setMasteryExpanded] = useState(true);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [titlePickerOpen, setTitlePickerOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  const refresh = () => onProfileChange?.();

  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const ownedIds = profile.unlockedBrawlers;
  const fav = BRAWLERS.find(b => b.id === profile.favoriteBrawlerId && ownedIds.includes(b.id))
    || BRAWLERS.find(b => ownedIds.includes(b.id))
    || BRAWLERS[0];
  const favoritePinId = getFavoritePinId(profile);
  const favMasteryXp = getBrawlerMasteryXp(profile, fav.id);
  const favMasteryLevel = getMasteryLevel(favMasteryXp);
  const favTrophies = getBrawlerTrophies(profile, fav.id);
  const favPeak = profile.brawlerTrophyPeak?.[fav.id] ?? favTrophies;
  const favDisplayRank = getBrawlerRank(Math.max(favTrophies, favPeak));
  const favMasteryTier = getMasteryTier(Math.max(1, favMasteryLevel || 1));
  const favFeatBadges = getDisplayStarFeatTierBadges(profile);
  const favFeatTier = favFeatBadges.length ? Math.max(...favFeatBadges) : 1;
  const favPinId = favoritePinId || pinIdFor(fav.id, "default");
  const introDisplayIconIds = getIntroDisplayIconIds(profile);
  const equippedPortraitBackgroundId = getEquippedPortraitBackgroundId(profile);
  const unlockedPortraitBackgrounds = PORTRAIT_BACKGROUNDS.filter(bg =>
    isPortraitBackgroundUnlocked(profile, bg.id),
  );
  const favMasteryTitleUnlocked = (profile.masteryTitlesUnlocked || []).includes(masteryTitleId(fav.id));
  const favMasteryTitleId = favMasteryTitleUnlocked ? masteryTitleId(fav.id) : undefined;
  const ownedPinIds = useMemo(() => sortOwnedPinIds(getOwnedPins(profile)), [profile]);
  const iconId = profile.profileIconId || DEFAULT_PROFILE_ICON_ID;
  const starGuardianActive = !readOnly && isStarGuardianActive();
  const ownerSubActive = readOnly
    ? ((profile.starGuardian as { activeUntil?: number } | undefined)?.activeUntil ?? 0) > Date.now()
    : starGuardianActive;
  const storedNameColor = profile.usernameColor || "#FFFFFF";
  const sgDays = getStarGuardianDaysRemaining();
  const displayClub = readOnly
    ? (profile.clubId ? getClub(profile.clubId) : null)
    : getMyClub();

  const viewerId = getCurrentProfile()?.playerId;
  const friendshipTitleText = readOnly
    ? getFriendshipTitleForViewer(profile, viewerId)
    : getProfileFriendshipTitles(profile)[0]?.text ?? null;

  const brawlerRanks = useMemo(() => {
    return BRAWLERS.map(b => {
      const trophies = getBrawlerTrophies(profile, b.id);
      const peak = profile.brawlerTrophyPeak?.[b.id] ?? trophies;
      const rank = computeBrawlerRankBarState(trophies, peak).badgeRank;
      return { brawler: b, rank, trophies };
    })
      .filter(x => ownedIds.includes(x.brawler.id))
      .sort((a, b) => b.rank - a.rank || b.trophies - a.trophies);
  }, [profile, ownedIds]);

  const ranksVisible = ranksExpanded ? brawlerRanks : brawlerRanks.slice(0, RANKS_PER_ROW * 2);
  const rankRows = chunk(ranksVisible, RANKS_PER_ROW);

  const brawlerMasteries = useMemo(() => {
    return BRAWLERS.map(b => {
      const xp = getBrawlerMasteryXp(profile, b.id);
      const level = getMasteryLevel(xp);
      return { brawler: b, xp, level, tier: getMasteryTier(Math.max(1, level || 1)) };
    })
      .filter(x => ownedIds.includes(x.brawler.id))
      .sort((a, b) => b.level - a.level || b.xp - a.xp);
  }, [profile, ownedIds]);

  const masteriesVisible = masteryExpanded ? brawlerMasteries : brawlerMasteries.slice(0, RANKS_PER_ROW * 2);
  const masteryRows = chunk(masteriesVisible, RANKS_PER_ROW);

  const winRate = profile.totalGamesPlayed > 0
    ? Math.round((profile.totalWins / profile.totalGamesPlayed) * 100)
    : 0;
  const bestWinStreak = getBestWinStreakRecord(profile);
  const bestStreakBrawler = bestWinStreak
    ? BRAWLERS.find(b => b.id === bestWinStreak.brawlerId)
    : null;

  const handleCopyPlayerId = async () => {
    const ok = await copyPlayerIdToClipboard(profile.playerId);
    if (ok) {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } else if (!readOnly) {
      setMsg({ text: t("profile.copyFailed"), ok: false });
      setTimeout(() => setMsg(null), 2000);
    }
  };

  const handleRename = () => {
    const r = renamePlayer(newName);
    setMsg({ text: r.success ? t("profile.nameChanged") : (r.error || t("common.error")), ok: !!r.success });
    if (r.success) {
      setRenaming(false);
      setNewName("");
      refresh();
    }
    setTimeout(() => setMsg(null), 2500);
  };

  const handleFav = (id: string) => {
    if (!ownedIds.includes(id)) return;
    setFavoriteBrawler(id);
    setFavPickerOpen(false);
    refresh();
  };

  const handleFavPin = (pinId: string) => {
    setFavoritePin(pinId);
    setFavPinPickerOpen(false);
    refresh();
  };

  const handlePortraitBackground = (backgroundId: string) => {
    const r = setEquippedPortraitBackground(backgroundId);
    if (r.success) {
      setFavBgPickerOpen(false);
      refresh();
    } else {
      setMsg({ text: r.error || t("common.error"), ok: false });
      setTimeout(() => setMsg(null), 2500);
    }
  };

  return (
    <PageBg variant="profile" style={{ fontFamily: "var(--app-font-sans)" }}>
      <PageHeader onBack={onBack} title={title} />

      <PageBody
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "6px 8px 10px",
          maxWidth: "none",
          width: "100%",
          margin: 0,
          overflow: "hidden",
        }}
      >
        <div style={mainGrid}>
          <div style={leftCol}>
            <div style={identityCard}>
              {readOnly ? (
                <div style={{ ...iconBtn, cursor: "default" }}>
                  <img src={getProfileIconImage(iconId, base)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <button type="button" onClick={() => { setIntroIconPickerSlot(null); setIconPickerOpen(true); }} style={iconBtn} title={t("profile.changeIcon")}>
                  <img src={getProfileIconImage(iconId, base)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span style={iconGear}><EmojiIcon emoji="⚙" size={20} /></span>
                </button>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
              <UsernameDisplay
                name={profile.username}
                colorValue={storedNameColor}
                subActive={ownerSubActive}
              />
                {friendshipTitleText && (
                  <div style={{ marginTop: 4 }}>
                    <PlayerMasteryTitle text={friendshipTitleText} friendship fontSize={12} style={{ textAlign: "left" }} />
                  </div>
                )}
                {profile.equippedMasteryTitle && (
                  <div style={{ marginTop: 4 }}>
                    <PlayerMasteryTitle titleId={profile.equippedMasteryTitle} fontSize={12} style={{ textAlign: "left" }} />
                  </div>
                )}
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 800, letterSpacing: 1.2,
                    color: "rgba(255,255,255,0.55)", fontFamily: "monospace",
                  }}>
                    {formatPlayerIdDisplay(profile.playerId)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPlayerId}
                    className="ui-btn ui-btn--secondary"
                    title={t("profile.copyId")}
                    style={{ padding: "3px 8px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, minHeight: 0 }}
                  >
                    {idCopied ? t("profile.copied") : t("profile.copyBtn")}
                  </button>
                </div>
                {starGuardianActive && <div style={sgBadge}><Tr id="profile.sgBadge" params={{ days: sgDays }} /></div>}
                {displayClub && onViewClub && (
                  <button
                    type="button"
                    onClick={() => onViewClub(displayClub.id)}
                    style={{
                      marginTop: 8, width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px",
                      background: "linear-gradient(135deg, rgba(255,138,101,0.25), rgba(0,0,0,0.4))",
                      border: "1px solid rgba(255,138,101,0.45)",
                      borderRadius: 10, cursor: "pointer", color: "#fff", textAlign: "left",
                    }}
                  >
                    <ClubAvatar club={displayClub} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}><Tr id="profile.club" /></div>
                      <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {displayClub.name}
                      </div>
                    </div>
                  </button>
                )}
                {!readOnly && (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      <button type="button" className="ui-btn ui-btn--secondary" style={miniAct} onClick={() => { setRenaming(true); setNewName(profile.username); }}>
                        <EmojiIcon emoji="✏️" size={18} /> {RENAME_GEM_COST}<GemIcon size={11} />
                      </button>
                      <button type="button" className="ui-btn ui-btn--secondary" style={miniAct} onClick={() => setColorPickerOpen(v => !v)}>
                        <EmojiIcon emoji="🎨" size={18} /> <Tr id="profile.color" />
                      </button>
                      <button type="button" className="ui-btn ui-btn--secondary" style={miniAct} onClick={() => setTitlePickerOpen(true)}>
                        <EmojiIcon emoji="👑" size={18} /> <Tr id="profile.pickTitle" />
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        style={miniAct}
                        onClick={() => {
                          setFavBgPickerOpen(v => !v);
                          setFavPickerOpen(false);
                          setFavPinPickerOpen(false);
                        }}
                      >
                        <EmojiIcon emoji="🖼️" size={18} /> <Tr id="profile.portraitBackground" />
                      </button>
                    </div>
                    {renaming && (
                      <div style={{ marginTop: 6 }}>
                        <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={16} className="ui-input" style={{ width: "100%", boxSizing: "border-box", fontSize: 12 }} />
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <button type="button" onClick={handleRename} className="ui-btn ui-btn--success" style={{ flex: 1, fontSize: 11 }}>OK</button>
                          <button type="button" onClick={() => setRenaming(false)} className="ui-btn ui-btn--secondary" style={{ flex: 1, fontSize: 11 }}>×</button>
                        </div>
                      </div>
                    )}
                    {colorPickerOpen && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
                          <Tr id="profile.colorBasic" />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {PROFILE_NAME_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              className="no-ui-shear profile-color-swatch"
                              onClick={() => { setUsernameColor(c); refresh(); }}
                              style={{
                                width: 22,
                                height: 22,
                                background: c,
                                border: storedNameColor === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.35)",
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </div>
                        {starGuardianActive ? (
                          <>
                            <div style={{ fontSize: 9, fontWeight: 800, color: "#FFD740", marginTop: 8, marginBottom: 4 }}>
                              <Tr id="profile.colorPremium" />
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {SUBSCRIBER_NAME_COLORS.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="no-ui-shear profile-color-swatch profile-color-swatch--premium"
                                  title={t(`profile.colorPremium.${c.id.slice(3)}`)}
                                  onClick={() => { setUsernameColor(c.id); refresh(); }}
                                  style={{
                                    width: 28,
                                    height: 22,
                                    background: c.gradient,
                                    border: storedNameColor === c.id ? "2px solid #fff" : "1px solid rgba(255,255,255,0.35)",
                                    cursor: "pointer",
                                    boxShadow: `0 0 6px ${c.glow}`,
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.35 }}>
                            <Tr id="profile.colorPremiumLocked" />
                          </div>
                        )}
                      </div>
                    )}
                    {msg && <div style={{ marginTop: 4, fontSize: 10, color: msg.ok ? "#69F0AE" : "#FF7043" }}><TextWithEmojis text={msg.text} emojiSize={24} /></div>}
                  </>
                )}
              </div>
            </div>

            <div style={favCharacterCard}>
              <ProfileFavoriteBrawlerCard
                brawlerId={fav.id}
                brawlerColor={fav.color}
                displayName={getBrawlerDisplayName(fav)}
                nameColor={fav.color}
                pinId={favPinId}
                masteryLevel={Math.max(1, favMasteryLevel || 1)}
                masteryTier={favMasteryTier}
                featTierBadge={favFeatTier}
                brawlerRank={favDisplayRank}
                masteryTitleId={favMasteryTitleId}
                profileIconIds={introDisplayIconIds}
                portraitBackgroundId={equippedPortraitBackgroundId}
                readOnly={readOnly}
                onPickBrawler={readOnly ? undefined : () => { setFavPickerOpen(v => !v); setFavPinPickerOpen(false); setFavBgPickerOpen(false); }}
                onPickPin={readOnly ? undefined : () => { setFavPinPickerOpen(v => !v); setFavPickerOpen(false); setFavBgPickerOpen(false); }}
                onPickIntroIcon={readOnly ? undefined : slot => {
                  setIntroIconPickerSlot(slot);
                  setIconPickerOpen(true);
                  setFavPickerOpen(false);
                  setFavPinPickerOpen(false);
                }}
              />
              {!readOnly && favPinPickerOpen && (
                <div style={favPinGrid}>
                  {ownedPinIds.map(pinId => (
                    <button
                      key={pinId}
                      type="button"
                      onClick={() => handleFavPin(pinId)}
                      style={{
                        padding: 4,
                        borderRadius: 10,
                        border: pinId === favoritePinId ? "2px solid #FFD54F" : "1px solid rgba(255,255,255,0.12)",
                        background: pinId === favoritePinId ? "rgba(255,213,79,0.15)" : "rgba(0,0,0,0.35)",
                        cursor: "pointer",
                      }}
                    >
                      <PinIcon pinId={pinId} size={40} glow={pinId === favoritePinId} />
                    </button>
                  ))}
                </div>
              )}
              {!readOnly && favBgPickerOpen && (
                <div style={favPinGrid}>
                  {unlockedPortraitBackgrounds.map(bg => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handlePortraitBackground(bg.id)}
                      title={bg.label}
                      style={{
                        padding: 3,
                        borderRadius: 10,
                        border: bg.id === equippedPortraitBackgroundId ? "2px solid #CE93D8" : "1px solid rgba(255,255,255,0.12)",
                        background: bg.id === equippedPortraitBackgroundId ? "rgba(206,147,216,0.2)" : "rgba(0,0,0,0.35)",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={getPortraitBackgroundThumbSrc(bg.id, base)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: 52, height: Math.round(52 * 1.02), objectFit: "fill", borderRadius: 6, display: "block" }}
                      />
                    </button>
                  ))}
                </div>
              )}
              {!readOnly && favPickerOpen && (
                <div style={favGrid}>
                  {BRAWLERS.filter(b => ownedIds.includes(b.id)).map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleFav(b.id)}
                      style={{
                        width: 44, height: 44, borderRadius: 0, padding: 0, overflow: "hidden",
                        border: b.id === fav.id ? `2px solid ${b.color}` : "none",
                        background: b.id === fav.id ? `${b.color}33` : "rgba(0,0,0,0.35)",
                        cursor: "pointer",
                      }}
                    >
                      <img src={brawlerAvatarUrl(b.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={rightCol}>
            <div style={trophyBar}>
              <TrophyIcon size={36} />
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)" }}><Tr id="profile.trophiesLabel" /></div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#FFD700", lineHeight: 1 }}>
                  {profile.trophies.toLocaleString("ru-RU")}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                  <Tr id="profile.trophiesPeak" params={{ peak: (profile.trophyPeak ?? profile.trophies).toLocaleString("ru-RU") }} />
                </div>
              </div>
            </div>

            <div style={panel}>
              <button type="button" onClick={() => setRanksExpanded(v => !v)} style={panelHead}>
                <span style={panelHeadLabel}><Tr id="profile.brawlersRanks" /></span>
                <span style={panelHeadArrow}>{ranksExpanded ? "▲" : "▼"}</span>
              </button>
              <div style={{ marginTop: 6 }}>
                {rankRows.map((row, ri) => (
                  <div key={ri} style={rankGridRow}>
                    {row.map(({ brawler, rank }) => (
                      <div key={brawler.id} style={rankCell}>
                        <img src={brawlerAvatarUrl(brawler.id)} alt="" style={rankAvatar} />
                        <RankBadgeIcon rank={rank} size={44} />
                      </div>
                    ))}
                  </div>
                ))}
                {!ranksExpanded && brawlerRanks.length > RANKS_PER_ROW * 2 && (
                  <button type="button" onClick={() => setRanksExpanded(true)} style={moreBtn}>
                    <Tr id="profile.moreBrawlers" params={{ count: brawlerRanks.length - RANKS_PER_ROW * 2 }} />
                  </button>
                )}
              </div>
            </div>

            <div style={panel}>
              <button type="button" onClick={() => setMasteryExpanded(v => !v)} style={panelHead}>
                <span style={panelHeadLabel}><Tr id="profile.brawlersMastery" /></span>
                <span style={panelHeadArrow}>{masteryExpanded ? "▲" : "▼"}</span>
              </button>
              <div style={{ marginTop: 6 }}>
                {masteryRows.map((row, ri) => (
                  <div key={ri} style={rankGridRow}>
                    {row.map(({ brawler, level }) => (
                      <div key={brawler.id} style={rankCell}>
                        <img src={brawlerAvatarUrl(brawler.id)} alt="" style={rankAvatar} />
                        <MasteryBadgeMini level={level} size={44} />
                        {level >= MAX_MASTERY_LEVEL && BRAWLER_MASTERY_TITLES[brawler.id] && (
                          <div style={{ width: "100%", padding: "0 2px", boxSizing: "border-box" }}>
                            <PlayerMasteryTitle text={BRAWLER_MASTERY_TITLES[brawler.id]} fontSize={8} style={{ lineHeight: 1.15 }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {!masteryExpanded && brawlerMasteries.length > RANKS_PER_ROW * 2 && (
                  <button type="button" onClick={() => setMasteryExpanded(true)} style={moreBtn}>
                    <Tr id="profile.moreBrawlersMastery" params={{ count: brawlerMasteries.length - RANKS_PER_ROW * 2 }} />
                  </button>
                )}
              </div>
            </div>

            <div style={statsRowWrap}>
              <div style={accountStatsSection}>
                <div style={sectionHead}><Tr id="profile.accountStats" /></div>
                <div style={accountStatsGrid}>
                  <AccountStat label={t("profile.gamesPlayed")} value={profile.totalGamesPlayed} />
                  <AccountStat label={t("profile.winsStat")} value={profile.totalWins} accent="#69F0AE" />
                  <AccountStat label={t("profile.losses")} value={profile.totalLosses} accent="#FF8A80" />
                  <AccountStat label={t("profile.winRate")} value={`${winRate}%`} accent="#FFD54F" />
                  <AccountStat label={t("profile.brawlersUnlocked")} value={`${ownedIds.length} / ${BRAWLERS.length}`} />
                  <AccountStat label={t("profile.coins")} value={profile.coins.toLocaleString("ru-RU")} />
                  <AccountStat label={t("profile.gems")} value={profile.gems.toLocaleString("ru-RU")} />
                  <AccountStat label={t("profile.powerPoints")} value={profile.powerPoints.toLocaleString("ru-RU")} />
                </div>
              </div>
              <div style={accountStatsSection}>
                <div style={sectionHead}><Tr id="ranked.profileStats" /></div>
                <div style={accountStatsGrid}>
                  <AccountStat label={t("ranked.statsGames")} value={profile.rankedGames ?? 0} />
                  <AccountStat label={t("ranked.statsWins")} value={profile.rankedWins ?? 0} accent="#69F0AE" />
                  <AccountStat label={t("ranked.statsLosses")} value={profile.rankedLosses ?? 0} accent="#FF8A80" />
                  <AccountStat
                    label={t("ranked.statsWinRate")}
                    value={`${(profile.rankedGames ?? 0) > 0 ? Math.round(((profile.rankedWins ?? 0) / (profile.rankedGames ?? 1)) * 100) : 0}%`}
                    accent="#FFD54F"
                  />
                  <AccountStat label={t("ranked.statsCups")} value={profile.rankedCups ?? 0} accent="#CE93D8" />
                  <AccountStat label={t("ranked.statsBestBrawlerRank")} value={bestBrawlerRankedRank(profile)} accent="#E1BEE7" />
                </div>
                <div style={rankedLeagueCardsRow}>
                  <RankedLeagueProfileCard
                    label={t("ranked.statsCurrentLeague")}
                    standing={rankedStandingFromTotalCups(getProfileRankedCups(profile))}
                    cups={getProfileRankedCups(profile)}
                    t={t}
                  />
                  <RankedLeagueProfileCard
                    label={t("ranked.statsBestLeague")}
                    standing={rankedStandingFromTotalCups(getProfileRankedPeakCups(profile))}
                    cups={getProfileRankedPeakCups(profile)}
                    t={t}
                  />
                </div>
              </div>
            </div>
            <div style={accountStatsSection}>
              {getDisplayStarFeatTierBadges(profile).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ ...sectionHead, marginBottom: 8 }}><Tr id="starFeat.profileBadges" /></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    {getDisplayStarFeatTierBadges(profile).map(tier => (
                      <img
                        key={tier}
                        src={`${base}${starFeatBadgeImg(tier as 1 | 2 | 3 | 4 | 5 | 6)}`}
                        alt=""
                        title={t("starFeat.tierBadgeEarned")}
                        style={{ width: 88, height: 88, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {bestWinStreak && bestStreakBrawler && isWinStreakVisible(bestWinStreak.streak) && (
                <div style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(255,87,34,0.18), rgba(0,0,0,0.45))",
                  border: "1px solid rgba(255,152,0,0.45)",
                }}>
                  <img
                    src={brawlerAvatarUrl(bestStreakBrawler.id)}
                    alt=""
                    style={{
                      width: 44, height: 44, borderRadius: 10,
                      border: `2px solid ${bestStreakBrawler.color}`,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)" }}>
                      <Tr id="profile.bestWinStreak" />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: bestStreakBrawler.color, marginTop: 2 }}>
                      {getBrawlerDisplayName(bestStreakBrawler)}
                    </div>
                  </div>
                  <WinStreakFlame streak={bestWinStreak.streak} size={42} />
                </div>
              )}
            </div>
          </div>
        </div>
      </PageBody>

      {!readOnly && iconPickerOpen && (
        <ProfileIconPicker
          profile={profile}
          base={base}
          selectedId={introIconPickerSlot != null ? introDisplayIconIds[introIconPickerSlot] : iconId}
          onClose={() => { setIconPickerOpen(false); setIntroIconPickerSlot(null); }}
          onSelect={() => { setIconPickerOpen(false); setIntroIconPickerSlot(null); refresh(); }}
          onPick={introIconPickerSlot != null
            ? (id) => setIntroDisplayIcon(introIconPickerSlot, id)
            : undefined}
        />
      )}
      {!readOnly && titlePickerOpen && (
        <div style={titlePickerOverlay} onClick={() => setTitlePickerOpen(false)} role="dialog" aria-modal>
          <div style={titlePickerSheet} onClick={e => e.stopPropagation()}>
            <div style={titlePickerHeader}>
              <button type="button" onClick={() => setTitlePickerOpen(false)} style={titlePickerNavBtn} aria-label={t("common.back")}>←</button>
              <h2 style={titlePickerHeading}><Tr id="profile.pickTitleModal" /></h2>
              <button type="button" onClick={() => setTitlePickerOpen(false)} style={titlePickerNavBtn} aria-label={t("common.close")}>⌂</button>
            </div>
            <div style={titlePickerListWrap}>
              {(profile.masteryTitlesUnlocked?.length ?? 0) === 0 ? (
                <p style={titlePickerEmpty}><Tr id="profile.noTitlesUnlocked" /></p>
              ) : (
                <div style={titlePickerList}>
                  <button
                    type="button"
                    onClick={() => { setEquippedMasteryTitle(null); refresh(); setTitlePickerOpen(false); }}
                    style={{
                      ...titlePickerRowBtn,
                      border: !profile.equippedMasteryTitle ? "1px solid #FFD740" : "1px solid rgba(255,255,255,0.12)",
                      background: !profile.equippedMasteryTitle ? "rgba(255,215,64,0.12)" : "rgba(0,0,0,0.35)",
                    }}
                  >
                    <Tr id="profile.noTitle" />
                  </button>
                  {(profile.masteryTitlesUnlocked || []).map(titleId => (
                    <button
                      key={titleId}
                      type="button"
                      onClick={() => { setEquippedMasteryTitle(titleId); refresh(); setTitlePickerOpen(false); }}
                      style={{
                        ...titlePickerRowBtn,
                        border: profile.equippedMasteryTitle === titleId ? "1px solid #FFD740" : "1px solid rgba(255,255,255,0.12)",
                        background: profile.equippedMasteryTitle === titleId ? "rgba(255,215,64,0.12)" : "rgba(0,0,0,0.35)",
                      }}
                    >
                      <PlayerMasteryTitle titleId={titleId} fontSize={13} style={{ textAlign: "left" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageBg>
  );
}

function MasteryBadgeMini({ level, size = 40 }: { level: number; size?: number }) {
  const tier = level > 0 ? getMasteryTier(level) : "bronze";
  const tierLevel = level > 0 ? getMasteryTierLevel(level) : null;
  const kind = level > 0 ? getMasteryDisplayKind(level) : "tier";
  return (
    <div style={{ position: "relative", width: size, height: size, opacity: level > 0 ? 1 : 0.72 }}>
      <img
        src={getMasteryBadgeSrc(tier)}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
      />
      {level === 0 && (
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: Math.max(10, Math.round(size * 0.32)), color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}>
          0
        </span>
      )}
      {level > 0 && kind === "tier" && tierLevel != null && (
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: Math.max(10, Math.round(size * 0.32)), color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}>
          {tierLevel}
        </span>
      )}
      {level > 0 && kind === "pin" && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.42) }}><EmojiIcon emoji="📌" size={24} /></span>
      )}
      {level > 0 && kind === "title" && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.42) }}><EmojiIcon emoji="👑" size={24} /></span>
      )}
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function RankedLeagueProfileCard({
  label,
  standing,
  cups,
  t,
}: {
  label: string;
  standing: RankedStanding;
  cups: number;
  t: (key: string) => string;
}) {
  const league = RANKED_LEAGUES[standing.leagueIndex]!;
  return (
    <div style={{
      ...rankedLeagueCard,
      border: `1px solid ${league.color}66`,
      boxShadow: `0 4px 18px ${league.color}22`,
    }}>
      <div style={rankedLeagueCardLabel}>{label}</div>
      <img
        src={rankedLeagueIconUrl(league.id)}
        alt=""
        className="ui-game-icon ranked-league-icon"
        style={{ width: 72, height: 72, objectFit: "contain", filter: "none" }}
      />
      <div style={{
        fontWeight: 900,
        fontSize: 12,
        color: league.color,
        fontStyle: "italic",
        textAlign: "center",
        lineHeight: 1.25,
        textShadow: `0 1px 4px rgba(0,0,0,0.85), 0 0 10px ${league.accent}44`,
      }}>
        {t(`ranked.leagueFull.${league.id}`)} {tierRoman(standing.tier)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#CE93D8", letterSpacing: 0.2 }}>
        {cups.toLocaleString("ru-RU")} <Tr id="ranked.cupsShort" />
      </div>
    </div>
  );
}

function AccountStat({ label, value, accent = "rgba(255,255,255,0.92)" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={accountStatCell}>
      <div style={accountStatLabel}>{label}</div>
      <div style={{ ...accountStatValue, color: accent }}>{value}</div>
    </div>
  );
}

const glass: CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.09), rgba(6,8,28,0.82))",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  backdropFilter: "blur(10px) saturate(1.15)",
  WebkitBackdropFilter: "blur(10px) saturate(1.15)",
};

const mainGrid: CSSProperties = {
  flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "260px 1fr", gap: 8, height: "100%", overflow: "hidden",
};
const leftCol: CSSProperties = { width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto" };
const rightCol: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto" };
const identityCard: CSSProperties = { ...glass, display: "flex", gap: 10, padding: 10, alignItems: "flex-start", width: "100%", boxSizing: "border-box" };
const iconBtn: CSSProperties = { width: 72, height: 72, flexShrink: 0, padding: 0, borderRadius: 12, border: "2px solid rgba(255,255,255,0.28)", overflow: "hidden", background: "#1a1028", position: "relative" };
const iconGear: CSSProperties = { position: "absolute", top: 2, left: 2, fontSize: 10, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "1px 4px", color: "#fff" };
const miniAct: CSSProperties = { fontSize: 10, padding: "4px 8px" };
const sgBadge: CSSProperties = { marginTop: 4, display: "inline-block", fontSize: 9, fontWeight: 900, background: "linear-gradient(135deg, #FFD700, #CE93D8)", color: "#311B92", borderRadius: 999, padding: "2px 8px" };
const favCharacterCard: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "4px 2px 8px", display: "flex", flexDirection: "column", alignItems: "stretch", flexShrink: 0, overflow: "hidden" };
const favGrid: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center" };
const favPinGrid: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center",
  maxHeight: 160, overflowY: "auto", width: "100%", padding: "4px 2px",
};
const trophyBar: CSSProperties = { ...glass, display: "flex", alignItems: "center", gap: 12, padding: "8px 14px" };
const panel: CSSProperties = { ...glass, padding: 10, flexShrink: 0 };
const panelHead: CSSProperties = {
  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
  background: "transparent", border: "none", color: "rgba(255,255,255,0.88)", fontWeight: 800,
  fontSize: 11, cursor: "pointer", padding: "4px 6px 4px 10px", minHeight: 24, lineHeight: 1.35, flexShrink: 0,
  boxSizing: "border-box",
};
const panelHeadLabel: CSSProperties = {
  flex: 1, minWidth: 0, textAlign: "left", letterSpacing: "0.02em", whiteSpace: "nowrap",
  paddingLeft: 2,
};
const panelHeadArrow: CSSProperties = { flexShrink: 0, fontSize: 10, opacity: 0.75, lineHeight: 1 };
const sectionHead: CSSProperties = {
  fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", color: "rgba(255,255,255,0.75)",
  marginBottom: 8, padding: "4px 0", lineHeight: 1.35,
};
const rankGridRow: CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${RANKS_PER_ROW}, 1fr)`, gap: 6, marginBottom: 6 };
const rankCell: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  padding: 0, color: "#fff", boxSizing: "border-box",
};
const rankAvatar: CSSProperties = { width: 48, height: 48, borderRadius: 0, objectFit: "cover" };
const rankName: CSSProperties = {
  fontSize: 9, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.1,
  width: "100%", paddingLeft: 4, paddingRight: 2, boxSizing: "border-box",
};
const moreBtn: CSSProperties = { width: "100%", padding: 6, fontSize: 11, borderRadius: 8, cursor: "pointer", border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.5)" };
const statsRowWrap: CSSProperties = { display: "flex", flexDirection: "row", gap: 10, flexShrink: 0, alignItems: "flex-start" };
const accountStatsSection: CSSProperties = { flex: 1, minWidth: 0, padding: "2px 0 8px" };
const accountStatsGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, alignContent: "start" };
const rankedLeagueCardsRow: CSSProperties = { display: "flex", flexDirection: "row", gap: 8, marginTop: 10, alignItems: "stretch" };
const rankedLeagueCard: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "12px 8px",
  borderRadius: 12,
  background: "rgba(0,0,0,0.38)",
};
const rankedLeagueCardLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: "rgba(255,255,255,0.52)",
  letterSpacing: 0.35,
  textTransform: "uppercase",
  textAlign: "center",
  lineHeight: 1.2,
};
const accountStatCell: CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.28)" };
const accountStatLabel: CSSProperties = { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 };
const accountStatValue: CSSProperties = { fontSize: 18, fontWeight: 900, lineHeight: 1.1 };
const titlePickerOverlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9000, background: "rgba(8, 4, 24, 0.72)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const titlePickerSheet: CSSProperties = {
  width: "min(420px, 96vw)", maxHeight: "min(70vh, 480px)", display: "flex", flexDirection: "column",
  background: "linear-gradient(165deg, rgba(88, 40, 140, 0.92), rgba(24, 12, 48, 0.96))",
  border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.55)", overflow: "hidden",
};
const titlePickerHeader: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)",
};
const titlePickerHeading: CSSProperties = {
  margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "0.04em", color: "#fff",
  textShadow: "0 2px 8px rgba(0,0,0,0.6)", textAlign: "center", flex: 1,
};
const titlePickerNavBtn: CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 18, cursor: "pointer", fontWeight: 800, flexShrink: 0,
};
const titlePickerListWrap: CSSProperties = { flex: 1, minHeight: 0, overflow: "auto", padding: "12px 14px 16px" };
const titlePickerList: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const titlePickerRowBtn: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", textAlign: "left",
};
const titlePickerEmpty: CSSProperties = {
  margin: 0, padding: "24px 8px", textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700,
};
