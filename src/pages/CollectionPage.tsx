import { useEffect, useState, useMemo } from "react";
import { BRAWLERS, BRAWLER_LORE, BRAWLER_RARITY_LABEL, getBrawlerById, getScaledStats } from "../entities/BrawlerData";
import { brawlerAvatarUrl } from "../utils/modeAssets";
import { CHESTS } from "../utils/chests";
import {
  getCurrentProfile, upgradeBrawler, upgradeBrawlerCost, MAX_BRAWLER_LEVEL,
  getBrawlerTrophies, getBrawlerRank,
  BRAWLER_RANK_TABLE, MAX_BRAWLER_RANK,
  markBrawlerSeen,
  getBrawlerStars,
  buyBrawlerStarWithGems,
  buyBrawlerStarsPackWithGems,
  hasPendingBrawlerStarPick,
  getPendingBrawlerStarPicks,
  getUnownedStarIndices,
  claimPendingBrawlerStar,
} from "../utils/localStorageAPI";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import { collectionBrawler3DSize, COLLECTION_BRAWLER_TRANSFORM } from "../utils/menuBrawler3DLayout";
import BrawlerRankRewardsModal from "../components/BrawlerRankRewardsModal";
import BrawlerRankBar, { RankBadgeIcon } from "../components/BrawlerRankBar";
import { computeBrawlerRankBarState } from "../utils/brawlerRankUI";
import { sortBrawlers, type BrawlerSortKey, RARITY_AVATAR_BG } from "./CharacterSelect";
import { CoinIcon, PowerIcon, GemIcon } from "../components/GameIcons";
import { PETS, PET_RARITY_LABEL, PET_RARITY_ORDER, getPetById } from "../entities/PetData";
import { getEffectivePetGemCost, getEffectiveConstellation, getEffectiveStarCosts } from "../utils/characterBalance";
import PetSvg from "../components/PetSvg";
import { petPageBackgroundStyle } from "../game/pet3DRenderer";
import BrawlerConstellationView from "../components/BrawlerConstellationView";
import { GlowingStarStyles } from "../components/GlowingStar";
import { EmojiIcon, TextWithEmojis } from "../components/EmojiIcon";
import { Tr  } from "../i18n/Tr";
import {
  useI18n,
  brawlerName,
  brawlerRarityLabel,
  brawlerAttackName,
  brawlerSuperName,
  brawlerAttackDesc,
  brawlerSuperDesc,
  brawlerLore,
  petName,
  petEffectLabel,
  petRarityLabel,
  starName,
  starEffect,
} from "../i18n";

interface CollectionPageProps {
  onBack: () => void;
}

export default function CollectionPage({ onBack }: CollectionPageProps) {
  const { t } = useI18n();
  const sortOptions: { key: BrawlerSortKey; label: string }[] = [
    { key: "rarity", label: t("char.sort.rarity") },
    { key: "level", label: t("char.sort.level") },
    { key: "name", label: t("char.sort.name") },
    { key: "hp", label: t("char.sort.hp") },
    { key: "damage", label: t("char.sort.damage") },
    { key: "speed", label: t("char.sort.speed") },
    { key: "range", label: t("char.sort.range") },
  ];
  const [profile, setProfile] = useState(getCurrentProfile());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const p = getCurrentProfile();
    const menuId = p?.selectedBrawlerId;
    if (menuId && p?.unlockedBrawlers.includes(menuId)) return menuId;
    return null;
  });
  const [sortKey, setSortKey] = useState<BrawlerSortKey>("rarity");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [rankModalBrawlerId, setRankModalBrawlerId] = useState<string | null>(null);
  const [tab, setTab] = useState<"brawlers" | "pets" | "stars">("brawlers");
  const [pickedStar, setPickedStar] = useState<number | null>(null);
  const [starPickMode, setStarPickMode] = useState(false);
  const [petsBgId, setPetsBgId] = useState<string | null>(null);

  const ownedSorted = useMemo(() => {
    if (!profile) return [];
    const owned = BRAWLERS.filter(b => profile.unlockedBrawlers.includes(b.id));
    return sortBrawlers(owned, sortKey, profile.brawlerLevels);
  }, [profile, sortKey]);

  // Выбранный в списке, иначе боец из главного меню, иначе первый в сортировке.
  const menuBrawlerId =
    profile?.selectedBrawlerId && profile.unlockedBrawlers.includes(profile.selectedBrawlerId)
      ? profile.selectedBrawlerId
      : null;
  const activeId =
    (selectedId && ownedSorted.some(b => b.id === selectedId) ? selectedId : null)
    ?? (menuBrawlerId && ownedSorted.some(b => b.id === menuBrawlerId) ? menuBrawlerId : null)
    ?? (ownedSorted[0]?.id ?? null);

  // Когда поверх коллекции открыт popup, колесо/тач не должны прокручивать
  // страницу за ним. Само окно при этом остаётся прокручиваемым.
  useEffect(() => {
    const hasPopup = !!rankModalBrawlerId || pickedStar !== null;
    if (!hasPopup) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [rankModalBrawlerId, pickedStar]);

  if (!profile || ownedSorted.length === 0 || !activeId) {
    const baseUrl = (import.meta as any).env?.BASE_URL ?? "/";
    return (
      <div style={{
        minHeight: "100%",
        backgroundImage: `url("${baseUrl}collection-bg.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#040712",
        color: "white", display: "flex", flexDirection: "column",
        fontFamily: "var(--app-font-sans)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(6,4,22,0.46) 0%, rgba(6,4,22,0.32) 35%, rgba(6,4,22,0.62) 100%)",
        }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid var(--bd-1)", background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 100%)", backdropFilter: "blur(10px) saturate(1.15)" }}>
          <button onClick={onBack} className="ui-back-btn">← <Tr id="common.back" /></button>
          <h2 className="ui-page-title" style={{ flex: 1, fontSize: 22, margin: 0, letterSpacing: "0.08em" }}><Tr id="collection.title" /></h2>
          <div style={{ width: 92 }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 72 }}><EmojiIcon emoji="🔒" size={24} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t-1)" }}><Tr id="collection.emptyTitle" /></div>
          <div style={{ fontSize: 13, color: "var(--t-3)", maxWidth: 420 }}>
            <Tr id="collection.emptyHint" />
          </div>
        </div>
      </div>
    );
  }

  const brawler = BRAWLERS.find(b => b.id === activeId)!;

  const handleUpgrade = () => {
    const result = upgradeBrawler(brawler.id);
    if (result.success) {
      setProfile(getCurrentProfile());
      setMsg({ text: t("char.upgraded"), ok: true });
    } else {
      setMsg({ text: result.error || t("char.notEnough"), ok: false });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const level = profile.brawlerLevels[brawler.id] || 1;
  const scaled = getScaledStats(brawler, level);
  const nextScaled = level < MAX_BRAWLER_LEVEL ? getScaledStats(brawler, level + 1) : null;
  const upgradeCost = upgradeBrawlerCost(level);
  const canUpgrade = level < MAX_BRAWLER_LEVEL && profile.coins >= upgradeCost.coins && profile.powerPoints >= upgradeCost.powerPoints;

  const trophies = getBrawlerTrophies(profile, brawler.id);
  const rank = getBrawlerRank(trophies);
  const nextReward = rank < MAX_BRAWLER_RANK ? BRAWLER_RANK_TABLE[rank] : null;
  const trophiesIntoNext = nextReward
    ? Math.max(0, trophies - (rank > 0 ? BRAWLER_RANK_TABLE[rank - 1].trophies : 0))
    : 0;
  const trophiesNeededForNext = nextReward
    ? nextReward.trophies - (rank > 0 ? BRAWLER_RANK_TABLE[rank - 1].trophies : 0)
    : 0;

  // Full-screen background that changes per tab and per selected brawler/pet.
  // Brawlers tab → that brawler's lore scene. Stars tab → starry cosmos.
  // Pets tab → equipped pet's background (or first owned pet) — falls back to soft green.
  const base = import.meta.env.BASE_URL;
  const petsTabBgId = petsBgId
    || profile?.equippedPetId
    || ((profile?.unlockedPets || [])[0] ?? null);
  const petsTabPet = petsTabBgId ? getPetById(petsTabBgId) : null;
  const petsTabBg = petPageBackgroundStyle(base, petsTabPet ?? undefined);
  const pageBgImage =
    tab === "stars"
      ? `url("${base}constellation-bg.png")`
      : tab === "brawlers"
        ? `url("${base}brawlers/backgrounds/${activeId}.png")`
        : tab === "pets"
          ? petsTabBg.backgroundImage
          : undefined;
  const pageBgColor =
    tab === "stars" ? "#03001a"
      : tab === "brawlers" ? "#03001a"
        : tab === "pets" ? petsTabBg.backgroundColor
          : "#0a1f12";
  const pendingStarPicks = getPendingBrawlerStarPicks(profile);
  const pendingStarPickCount = pendingStarPicks.length;

  const pageBgFallback =
    tab === "stars"
      ? "radial-gradient(ellipse at center, #1a0f4a 0%, #0a052a 70%, #03001a 100%)"
      : tab === "brawlers"
        ? "linear-gradient(135deg, #013A40 0%, #02575C 50%, #0CA4A5 100%)"
        : "linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)";

  return (
    <>
    <GlowingStarStyles />
    <div
      style={{
        height: "100%",
        backgroundImage: pageBgImage,
        backgroundColor: pageBgColor,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Soft fallback gradient when no image is loaded (also adds a tint over the painted bg) */}
      {!pageBgImage && (
        <div aria-hidden style={{ position: "absolute", inset: 0, background: pageBgFallback, pointerEvents: "none" }} />
      )}
      {/* Subtle dark vignette to ensure text remains readable on top of the painted scene */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.10) 18%, rgba(0,0,0,0.10) 75%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/*
        Единая верхняя панель: раньше тут были ДВЕ прозрачные полосы
        (header + tab bar), они визуально разрывали градиент бэкграунда.
        Теперь обе строки лежат на одном background с одним blur,
        разделитель внутри — лишь тонкая линия `borderTop` у tab-bar.
      */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0,
        display: "flex", flexDirection: "column",
        borderBottom: "1px solid var(--bd-1)",
        background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.30) 100%)",
        backdropFilter: "blur(10px) saturate(1.15)",
        WebkitBackdropFilter: "blur(10px) saturate(1.15)",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          padding: "14px 22px", gap: 12,
        }}>
          <button onClick={onBack} className="ui-back-btn">← <Tr id="common.back" /></button>
          <h2 className="ui-page-title" style={{ flex: 1, fontSize: 22, margin: 0, letterSpacing: "0.08em" }}>
            <Tr id="collection.title" />
          </h2>
          <div className="ui-resource-bar">
            <span className="ui-resource-pill ui-resource-pill--gold">
              <CoinIcon size={20} /> {(profile?.coins || 0).toLocaleString("ru-RU")}
            </span>
            <span className="ui-resource-pill ui-resource-pill--violet">
              <GemIcon size={20} /> {(profile?.gems || 0).toLocaleString("ru-RU")}
            </span>
            <span className="ui-resource-pill ui-resource-pill--violet">
              <PowerIcon size={20} /> {(profile?.powerPoints || 0).toLocaleString("ru-RU")}
            </span>
          </div>
        </div>
        <div style={{
          display: "flex", justifyContent: "center", gap: 8,
          padding: "10px 0 12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div className="ui-tab-bar">
            {(["brawlers", "pets", "stars"] as const).map(tabKey => {
              const active = tab === tabKey;
              const label = tabKey === "brawlers"
                ? t("collection.tab.brawlers")
                : (tabKey === "pets" ? t("collection.tab.pets") : t("collection.tab.stars"));
              const starsBadge = tabKey === "stars" && pendingStarPickCount > 0 ? pendingStarPickCount : 0;
              const starsGlow = tabKey === "stars" && pendingStarPickCount > 0;
              return (
                <button
                  key={tabKey}
                  onClick={() => {
                    setTab(tabKey);
                    if (tabKey !== "pets") setPetsBgId(null);
                    if (tabKey === "stars") {
                      const pending = getPendingBrawlerStarPicks(profile);
                      if (pending.length > 0 && !pending.includes(activeId)) {
                        setSelectedId(pending[0]);
                      }
                    }
                  }}
                  className={`ui-tab ${active ? "is-active" : ""}`}
                  style={starsGlow && !active ? {
                    boxShadow: "0 0 18px rgba(255,213,79,0.55)",
                    borderColor: "rgba(255,213,79,0.65)",
                  } : undefined}
                >
                  {label}
                  {starsBadge > 0 && (
                    <span style={{
                      marginLeft: 6,
                      fontSize: 10,
                      fontWeight: 900,
                      background: "linear-gradient(135deg,#FF6B00,#FFD54F)",
                      color: "#1a0a00",
                      borderRadius: 8,
                      padding: "1px 6px",
                      minWidth: 16,
                      display: "inline-block",
                      textAlign: "center",
                    }}>
                      {starsBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tab === "pets" ? (
        <PetsCollectionTab profile={profile} onPreviewPet={setPetsBgId} />
      ) : tab === "stars" ? (
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.10)", minHeight: 0, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <label style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 2, display: "block", marginBottom: 5 }}>
              <Tr id="collection.brawlersCount" params={{ count: ownedSorted.length }} />
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as BrawlerSortKey)}
              className="ui-input"
              style={{ width: "100%", fontSize: 12, padding: "8px 12px", cursor: "pointer" }}
            >
              {sortOptions.map(o => (
                <option key={o.key} value={o.key} style={{ background: "#0a0040" }}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, minHeight: 0 }}>
            {ownedSorted.map((b) => {
              const isSelected = b.id === activeId;
              const pendingStar = hasPendingBrawlerStarPick(b.id, profile);
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedId(b.id);
                    setStarPickMode(false);
                    setPickedStar(null);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: "var(--r-md)", cursor: "pointer", marginBottom: 6,
                    background: isSelected
                      ? `linear-gradient(135deg, ${b.color}33, ${b.color}11)`
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${pendingStar ? "#FFD54F" : isSelected ? b.color : "var(--bd-1)"}`,
                    boxShadow: pendingStar
                      ? "0 0 16px rgba(255,213,79,0.65)"
                      : isSelected ? `0 0 16px ${b.color}55` : "var(--sh-sm)",
                  }}
                >
                  <BrawlerSidebarAvatar brawler={b} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? b.color : "white", display: "flex", alignItems: "center", gap: 6 }}>
                      {brawlerName(b.id, b.name)}
                      {pendingStar && (
                        <span style={{
                          fontSize: 10, fontWeight: 900, minWidth: 18, textAlign: "center",
                          background: "linear-gradient(135deg,#FF6B00,#FFD54F)",
                          color: "#1a0a00", borderRadius: 8, padding: "1px 6px",
                        }}>1</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <StarsCollectionTab
          profile={profile}
          brawlerId={activeId}
          onChanged={() => setProfile(getCurrentProfile())}
          onMsg={(m, ok) => { setMsg({ text: m, ok: ok ?? true }); setTimeout(() => setMsg(null), 2200); }}
          pickedStar={pickedStar}
          onPickStar={setPickedStar}
          starPickMode={starPickMode}
          onStarPickMode={setStarPickMode}
        />
      </div>
      ) : (
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.10)", minHeight: 0, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <label style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 2, display: "block", marginBottom: 5 }}>
              <Tr id="collection.sortLabel" params={{ count: ownedSorted.length }} />
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as BrawlerSortKey)}
              className="ui-input"
              style={{ width: "100%", fontSize: 12, padding: "8px 12px", cursor: "pointer" }}
            >
              {sortOptions.map(o => (
                <option key={o.key} value={o.key} style={{ background: "#0a0040" }}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, minHeight: 0 }}>
            {ownedSorted.map((b) => {
              const lv = profile.brawlerLevels[b.id] || 1;
              const isSelected = b.id === activeId;
              const isNew = (profile.newBrawlers || []).includes(b.id);
              const pendingStar = hasPendingBrawlerStarPick(b.id, profile);
              const rarityColor = CHESTS[b.rarity].borderColor;
              const bTrophies = getBrawlerTrophies(profile, b.id);
              const bPeak = profile.brawlerTrophyPeak?.[b.id] ?? bTrophies;
              const bRank = computeBrawlerRankBarState(bTrophies, bPeak).badgeRank;
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedId(b.id);
                    if (isNew) {
                      markBrawlerSeen(b.id);
                      setProfile(getCurrentProfile());
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                    marginBottom: 6,
                    background: isSelected
                      ? `linear-gradient(135deg, ${b.color}33, ${b.color}11)`
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isNew ? "#FF4500" : pendingStar ? "#FFD54F" : isSelected ? b.color : "var(--bd-1)"}`,
                    boxShadow: isNew
                      ? "0 0 12px rgba(255,69,0,0.55)"
                      : pendingStar
                        ? "0 0 16px rgba(255,213,79,0.65)"
                        : isSelected
                        ? `0 0 16px ${b.color}55, inset 0 1px 0 rgba(255,255,255,0.06)`
                        : "var(--sh-sm)",
                    transition: "all var(--ease-mid)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0, width: 48, height: 48 }}>
                    <BrawlerSidebarAvatar brawler={b} size={48} />
                    <div
                      onClick={(e) => { e.stopPropagation(); setRankModalBrawlerId(b.id); }}
                      title={t("char.rankRewards")}
                      style={{
                        position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
                        cursor: "pointer",
                      }}
                    >
                      <RankBadgeIcon rank={bRank} size={32} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isNew ? "#FF6B00" : isSelected ? b.color : "white", display: "flex", alignItems: "center", gap: 4 }}>
                      {brawlerName(b.id, b.name)}
                      {isNew && <span style={{ fontSize: 9, fontWeight: 900, background: "linear-gradient(135deg,#FF4500,#FF6B00)", color: "white", borderRadius: 5, padding: "1px 5px", letterSpacing: 0.5 }}><Tr id="common.new" /></span>}
                      {pendingStar && (
                        <span style={{
                          fontSize: 10, fontWeight: 900, minWidth: 18, textAlign: "center",
                          background: "linear-gradient(135deg,#FF6B00,#FFD54F)",
                          color: "#1a0a00", borderRadius: 8, padding: "1px 6px",
                        }}>1</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}><Tr id="collection.levelTrophies" params={{ level: lv, trophies: bTrophies }} /></div>
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1,
                    background: rarityColor, color: "white",
                    borderRadius: 6, padding: "2px 6px",
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}>{brawlerRarityLabel(b.rarity, BRAWLER_RARITY_LABEL[b.rarity])}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            padding: "14px 18px",
            overflowY: "hidden",
            minHeight: 0,
            gap: 14,
            position: "relative",
            background: "transparent",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, paddingTop: 0, gap: 0, minHeight: "100%" }}>
            <div style={{ display: "flex", justifyContent: "center", width: "100%", transform: COLLECTION_BRAWLER_TRANSFORM, paddingTop: 20 }}>
              <BrawlerViewer3D
                brawlerId={brawler.id}
                color={brawler.color}
                size={collectionBrawler3DSize(false)}
                paused={!!rankModalBrawlerId}
                snapBackAfterDragMs={0}
              />
            </div>
            <div style={{ textAlign: "center", marginTop: "auto", paddingTop: 28, paddingBottom: 12, width: "100%" }}>
              <BrawlerRankBar
                brawlerId={brawler.id}
                trophies={trophies}
                onClick={() => setRankModalBrawlerId(brawler.id)}
              />
              {nextReward && (
                <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.82)" }}>
                  {t("collection.rankProgress", {
                    rank: rank + 1,
                    current: Math.min(trophiesIntoNext, trophiesNeededForNext),
                    needed: trophiesNeededForNext,
                  })}
                </div>
              )}
            </div>
          </div>
          <style>{`
            @keyframes rankBadgePulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 0 2px rgba(255,61,0,0.35), 0 0 14px 2px rgba(255,61,0,0.85); }
              50% { transform: scale(1.12); box-shadow: 0 0 0 3px rgba(255,61,0,0.45), 0 0 22px 4px rgba(255,61,0,1); }
            }
          `}</style>

          <div className="ui-card" style={{ flex: "0 0 380px", background: "linear-gradient(160deg, rgba(20,12,52,0.7) 0%, rgba(8,4,24,0.85) 100%)", backdropFilter: "blur(12px) saturate(1.18)", WebkitBackdropFilter: "blur(12px) saturate(1.18)", border: "1px solid var(--bd-2)", borderRadius: "var(--r-lg)", padding: 14, alignSelf: "stretch", overflowY: "auto", position: "relative", zIndex: 1, marginLeft: "auto", boxShadow: "var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[
                { key: "hp", label: t("char.stat.hp"), base: brawler.hp, current: scaled.hp, color: "#4CAF50" },
                { key: "damage", label: t("char.stat.damage"), base: brawler.attackDamage, current: scaled.attackDamage, color: "#FF5252" },
                { key: "speed", label: t("char.stat.speed"), base: brawler.speed, current: scaled.speed, color: "#40C4FF" },
                { key: "regen", label: t("char.stat.regen"), base: brawler.regenRate, current: brawler.regenRate, color: "#CE93D8" },
              ].map(stat => (
                <div key={stat.key} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--bd-1)",
                  borderRadius: "var(--r-md)",
                  padding: "8px 10px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}>
                  <div className="ui-eyebrow" style={{ marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: stat.color }}>{stat.current}</div>
                  {nextScaled && stat.key === "hp" && <div style={{ fontSize: 10, color: "#4CAF50" }}>→ {nextScaled.hp}</div>}
                  {nextScaled && stat.key === "damage" && <div style={{ fontSize: 10, color: "#FF5252" }}>→ {nextScaled.attackDamage}</div>}
                </div>
              ))}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--bd-1)",
                borderRadius: "var(--r-md)",
                padding: "10px 12px",
                marginBottom: 10,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontSize: 10, color: "#40C4FF", fontWeight: 700, marginBottom: 2 }}><Tr id="collection.attackLabel" params={{ name: brawlerAttackName(brawler.id, brawler.attackName) }} /></div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>{brawlerAttackDesc(brawler.id, brawler.attackDesc)}</div>
              <div style={{ fontSize: 10, color: "#FFD700", fontWeight: 700, marginBottom: 2, marginTop: 6 }}><Tr id="collection.superLabel" params={{ name: brawlerSuperName(brawler.id, brawler.superName) }} /></div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>{brawlerSuperDesc(brawler.id, brawler.superDesc)}</div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--bd-1)",
                borderRadius: "var(--r-md)",
                padding: "10px 12px",
                marginBottom: 10,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontSize: 10, color: brawler.color, fontWeight: 700, marginBottom: 4 }}><Tr id="char.history" /></div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.35 }}>
                {brawlerLore(brawler.id, BRAWLER_LORE[brawler.id] || brawler.description)}
              </div>
            </div>

            {level < MAX_BRAWLER_LEVEL ? (
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                  <Tr id="collection.upgradeCostPrefix" params={{ level: level + 1 }} /> <CoinIcon size={14} /> {upgradeCost.coins} + <PowerIcon size={14} /> {upgradeCost.powerPoints}
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={!canUpgrade}
                  className={`ui-btn ui-btn--block ui-btn--lg ${canUpgrade ? "ui-btn--primary" : "ui-btn--ghost"}`}
                  style={{ letterSpacing: "0.14em" }}
                >
                  {canUpgrade ? t("char.upgradeTo", { level: level + 1 }) : <><CoinIcon size={14} /> {upgradeCost.coins} + <PowerIcon size={14} /> {upgradeCost.powerPoints}</>}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#FFD700", fontWeight: 700, fontSize: 14 }}><Tr id="char.maxLevel" /></div>
            )}

            {msg && (
              <div style={{ textAlign: "center", marginTop: 10, color: msg.ok ? "#4CAF50" : "#FF5252", fontWeight: 700 }}>
                <TextWithEmojis text={msg.text} emojiSize={24} />
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {rankModalBrawlerId && (
        <BrawlerRankRewardsModal
          brawlerId={rankModalBrawlerId}
          onClose={() => { setRankModalBrawlerId(null); setProfile(getCurrentProfile()); }}
        />
      )}
      
    </div>
    </>
  );
}

function StarsCollectionTab({
  profile, brawlerId, onChanged, onMsg, pickedStar, onPickStar, starPickMode, onStarPickMode,
}: {
  profile: NonNullable<ReturnType<typeof getCurrentProfile>>;
  brawlerId: string;
  onChanged: () => void;
  onMsg: (m: string, ok?: boolean) => void;
  pickedStar: number | null;
  onPickStar: (s: number) => void;
  starPickMode: boolean;
  onStarPickMode: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const brawler = getBrawlerById(brawlerId) ?? BRAWLERS[0];
  const starCosts = getEffectiveStarCosts();
  const defs = getEffectiveConstellation(brawler.id);
  const owned = new Set(getBrawlerStars(profile, brawler.id));
  const missingCount = defs.length - owned.size;
  const activeStar = pickedStar ? defs.find(s => s.index === pickedStar) : null;
  const pendingPick = hasPendingBrawlerStarPick(brawler.id, profile);
  const pickable = starPickMode && pendingPick ? getUnownedStarIndices(profile, brawler.id) : [];
  const handleStarClick = (idx: number) => {
    if (starPickMode && pendingPick && !owned.has(idx)) {
      const r = claimPendingBrawlerStar(brawler.id, idx);
      const picked = defs.find(s => s.index === idx);
      const pickedName = picked ? starName(brawler.id, picked.index, picked.name) : "";
      onMsg(
        r.success ? t("collection.starReceived", { name: pickedName }) : (r.error || t("common.error")),
        r.success,
      );
      onStarPickMode(false);
      onChanged();
      return;
    }
    onPickStar(idx);
  };
  return (
    <div style={{ position: "relative", zIndex: 1, flex: 1, overflow: "hidden", padding: 18, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(240px, 320px)", gap: 14, alignItems: "start", flex: 1, minHeight: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0,
        }}>
          <BrawlerConstellationView
            brawlerId={brawler.id}
            ownedStars={Array.from(owned)}
            pickableStars={pickable}
            onPick={handleStarClick}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD740", marginBottom: 4, textShadow: "0 2px 8px rgba(0,0,0,0.9)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span><Tr id="collection.constellationTitle" params={{ name: brawlerName(brawler.id, brawler.name) }} /></span>
              {pendingPick && (
                <span style={{
                  fontSize: 11, fontWeight: 900, minWidth: 20, textAlign: "center",
                  background: "linear-gradient(135deg,#FF6B00,#FFD54F)",
                  color: "#1a0a00", borderRadius: 10, padding: "2px 8px",
                }}>1</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
              <Tr id="collection.starsOpened" params={{ count: owned.size }} />
              {pendingPick && <span style={{ marginLeft: 8, color: "#FFD54F", fontWeight: 800 }}><Tr id="collection.freeStarFromChest" /></span>}
            </div>
            {pendingPick && (
              <button
                type="button"
                onClick={() => onStarPickMode(!starPickMode)}
                className="ui-btn ui-btn--primary"
                style={{ marginTop: 10, boxShadow: "0 0 16px rgba(255,213,79,0.55)" }}
              >
                {starPickMode ? t("common.cancel") : t("collection.pickStar")}
              </button>
            )}
          </div>
          <div style={{
            alignSelf: "start",
            borderRadius: 12,
            padding: activeStar ? "10px 12px" : "8px 12px",
            background: "rgba(8,4,28,0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,215,64,0.28)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
          }}>
            {activeStar ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: owned.has(activeStar.index) ? "#FFD740" : "rgba(255,255,255,0.9)" }}>
                  <EmojiIcon emoji={activeStar.icon} size={18} /> {starName(brawler.id, activeStar.index, activeStar.name)}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.8)" }}>
                  {starEffect(brawler.id, activeStar.index, activeStar.effect)}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: owned.has(activeStar.index) ? "#FFD740" : "rgba(255,255,255,0.6)" }}>
                  {owned.has(activeStar.index) ? t("shop.stars.opened") : t("shop.stars.notOpened")}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                <Tr id="collection.pickStarHint" />
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        {missingCount > 0 && (
          <button
            onClick={() => {
              const next = defs.find(s => !owned.has(s.index));
              if (!next) return onMsg(t("shop.stars.allUnlocked"), false);
              const r = buyBrawlerStarWithGems(brawler.id, next.index);
              onMsg(r.success ? t("shop.stars.purchased") : (r.error || t("common.error")), !!r.success);
              onChanged();
            }}
            className="ui-btn ui-btn--cyan"
          >
            <Tr id="shop.stars.buyOne" params={{ cost: starCosts.singleGems }} />
          </button>
        )}
        {missingCount >= 3 && (
          <button
            onClick={() => {
              const r = buyBrawlerStarsPackWithGems(brawler.id);
              onMsg(
                r.success
                  ? t("collection.packPurchasedMsg", { count: r.gained?.length || 0 })
                  : (r.error || t("common.error")),
                !!r.success,
              );
              onChanged();
            }}
            className="ui-btn ui-btn--primary"
          >
            <Tr id="shop.stars.buyPack" params={{ cost: starCosts.pack3Gems }} />
          </button>
        )}
        {missingCount === 0 && (
          <div className="ui-pill ui-pill--success" style={{ padding: "10px 14px", fontSize: 12 }}>
            <EmojiIcon emoji="★" size={18} /> <Tr id="shop.stars.allOwned" />
          </div>
        )}
      </div>
    </div>
  );
}

function StarInfoModal({
  brawlerId, starIndex, onClose, onChanged, onMsg,
}: {
  brawlerId: string;
  starIndex: number;
  onClose: () => void;
  onChanged: () => void;
  onMsg: (m: string, ok?: boolean) => void;
}) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  if (!profile) return null;
  const starCosts = getEffectiveStarCosts();
  const defs = getEffectiveConstellation(brawlerId);
  const star = defs.find(s => s.index === starIndex);
  if (!star) return null;
  const owned = new Set(getBrawlerStars(profile, brawlerId));
  const isOpen = owned.has(starIndex);
  return (
    <div
      onClick={onClose}
      onWheel={(e) => e.preventDefault()}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="ui-glass-strong"
        style={{ width: 460, maxWidth: "95vw", borderRadius: "var(--r-lg)", padding: 18, boxShadow: "var(--sh-glow-gold), var(--sh-lg)" }}
      >
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--c-gold-3)", letterSpacing: "0.04em" }}><EmojiIcon emoji={star.icon} size={18} /> {starName(brawlerId, star.index, star.name)}</div>
        <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, color: "var(--t-2)" }}>{starEffect(brawlerId, star.index, star.effect)}</div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              const r = buyBrawlerStarWithGems(brawlerId, starIndex);
              onMsg(r.success ? t("shop.stars.purchased") : (r.error || t("common.error")), !!r.success);
              onChanged();
            }}
            disabled={isOpen}
            className={`ui-btn ${isOpen ? "ui-btn--ghost" : "ui-btn--cyan"}`}
          >
            {isOpen ? t("common.bought") : t("shop.stars.buyOne", { cost: starCosts.singleGems })}
          </button>
          <button onClick={onClose} className="ui-btn ui-btn--secondary">
            <Tr id="common.close" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pets sub-tab ──────────────────────────────────────────────────────────
const PET_RARITY_TINT: Record<string, string> = {
  common: "#9E9E9E", rare: "#42A5F5", epic: "#AB47BC",
  mythic: "#FF7043", legendary: "#FFD54F",
};

function BrawlerSidebarAvatar({
  brawler: b,
  size,
}: {
  brawler: typeof BRAWLERS[number];
  size: number;
}) {
  const base = import.meta.env.BASE_URL;
  const avatarBg = RARITY_AVATAR_BG[b.rarity] ?? RARITY_AVATAR_BG.rare;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 8,
      overflow: "hidden",
      flexShrink: 0,
      background: avatarBg,
      boxShadow: `0 2px 8px ${b.color}44`,
    }}>
      <img
        src={brawlerAvatarUrl(b.id)}
        alt={brawlerName(b.id, b.name)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          display: "block",
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

function PetsCollectionTab({
  profile,
  onPreviewPet,
}: {
  profile: ReturnType<typeof getCurrentProfile>;
  onPreviewPet?: (petId: string) => void;
}) {
  const { t } = useI18n();
  if (!profile) return null;
  const owned = new Set(profile.unlockedPets || []);
  const ownedPets = PETS
    .filter(p => owned.has(p.id))
    .sort((a, b) =>
      PET_RARITY_ORDER.indexOf(b.rarity) - PET_RARITY_ORDER.indexOf(a.rarity)
      || petName(a.id, a.name).localeCompare(petName(b.id, b.name)));
  const lockedPets = PETS
    .filter(p => !owned.has(p.id))
    .sort((a, b) => PET_RARITY_ORDER.indexOf(a.rarity) - PET_RARITY_ORDER.indexOf(b.rarity));

  return (
    <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: 22, minHeight: 0 }}>
      <div style={{
        fontSize: 11, color: "rgba(178,255,89,0.95)",
        letterSpacing: 3, fontWeight: 800, marginBottom: 10, paddingLeft: 4,
        textShadow: "0 1px 4px rgba(0,0,0,0.85)",
      }}><Tr id="collection.myPets" /> <span style={{ color: "rgba(255,255,255,0.7)", marginLeft: 6 }}>{ownedPets.length}/{PETS.length}</span></div>
      {ownedPets.length === 0 ? (
        <div style={{
          padding: 26, textAlign: "center",
          color: "rgba(255,255,255,0.55)", fontSize: 13,
          background: "rgba(0,0,0,0.25)", borderRadius: 12,
          border: "1px dashed rgba(255,255,255,0.10)",
          marginBottom: 18,
        }}><Tr id="collection.petsEmpty" /></div>
      ) : (
        <CollectionPetGrid pets={ownedPets} owned profile={profile} onPreviewPet={onPreviewPet} />
      )}

      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.78)",
        letterSpacing: 3, fontWeight: 800, marginBottom: 10, marginTop: 18, paddingLeft: 4,
        textShadow: "0 1px 4px rgba(0,0,0,0.85)",
      }}><Tr id="collection.locked" /> <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.55)" }}>{lockedPets.length}</span></div>
      <CollectionPetGrid pets={lockedPets} owned={false} profile={profile} onPreviewPet={onPreviewPet} />
    </div>
  );
}

function CollectionPetGrid({
  pets, owned, profile, onPreviewPet,
}: {
  pets: typeof PETS;
  owned: boolean;
  profile: ReturnType<typeof getCurrentProfile>;
  onPreviewPet?: (petId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      gap: 12,
    }}>
      {pets.map(p => {
        const isEquipped = owned && profile?.equippedPetId === p.id;
        const isNew = owned && (profile?.newPets || []).includes(p.id);
        return (
          <div key={p.id} onClick={() => onPreviewPet?.(p.id)} style={{
            position: "relative",
            cursor: onPreviewPet ? "pointer" : undefined,
            backgroundImage: owned
              ? `url("${import.meta.env.BASE_URL}pets/backgrounds/${p.id}.png")`
              : undefined,
            backgroundColor: owned ? p.secondaryColor : "rgba(0,0,0,0.45)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: owned ? `1.5px solid ${p.color}55` : "1.5px solid rgba(255,255,255,0.10)",
            borderRadius: 14, padding: "12px 8px 10px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <div style={{
              position: "absolute", top: 6, left: 6,
              width: 8, height: 8, borderRadius: 999,
              background: PET_RARITY_TINT[p.rarity],
              boxShadow: `0 0 6px ${PET_RARITY_TINT[p.rarity]}`,
            }} />
            {isEquipped && (
              <div style={{
                position: "absolute", top: 4, right: 4,
                fontSize: 8, fontWeight: 900, letterSpacing: 1,
                background: "#76FF03", color: "#1B5E20",
                borderRadius: 6, padding: "2px 5px",
              }}><Tr id="collection.equipped" /></div>
            )}
            {isNew && !isEquipped && (
              <div style={{
                position: "absolute", top: 4, right: 4,
                fontSize: 8, fontWeight: 900, letterSpacing: 1,
                background: "#FF1744", color: "white",
                borderRadius: 6, padding: "2px 5px",
              }}><Tr id="common.new" /></div>
            )}
            <div style={{
              width: 84, height: 84,
              display: "flex", alignItems: "center", justifyContent: "center",
              filter: owned ? "none" : "grayscale(0.85) brightness(0.55)",
            }}>
              <PetSvg pet={p} size={78} animated={owned} haloPulse={false} />
            </div>
            <div style={{
              fontSize: 11, fontWeight: 800,
              color: owned ? p.color : "rgba(255,255,255,0.5)",
              textAlign: "center",
            }}>{owned ? petName(p.id, p.name) : "???"}</div>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.55)",
              textAlign: "center", lineHeight: 1.2, minHeight: 22,
            }}>{owned ? petEffectLabel(p.id, p.effectLabel) : petRarityLabel(p.rarity, PET_RARITY_LABEL[p.rarity])}</div>
            {!owned && (
              <div style={{
                fontSize: 10, fontWeight: 800,
                color: "#40C4FF", marginTop: 2,
                display: "inline-flex", alignItems: "center", gap: 3,
              }}><GemIcon size={10} /> {getEffectivePetGemCost(p.rarity)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
