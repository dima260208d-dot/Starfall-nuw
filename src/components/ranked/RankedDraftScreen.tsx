import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMode } from "../../App";
import { BRAWLERS } from "../../entities/BrawlerData";
import { PETS, type PetDef } from "../../entities/PetData";
import {
  getBrawlerRank,
  getBrawlerStarsCount,
  getBrawlerTrophies,
  getCurrentProfile,
  getPetDisplayName,
  type UserProfile,
} from "../../utils/localStorageAPI";
import { sortBrawlers, type BrawlerSortKey } from "../../pages/CharacterSelect";
import { publicAssetBase } from "../../utils/modeAssets";
import { getModeInfo } from "../../data/modes";
import { useI18n, localizedModeInfo, petName } from "../../i18n";
import ModeInfoModal from "../ModeInfoModal";
import ModeIconImg from "../ModeIconImg";
import { PetGridCard, PetSkipCard, type PetCardOverlay } from "../PetGridCard";
import BrawlerSquareIcon, { type BrawlerSquareOverlay } from "./BrawlerSquareIcon";
import { Tr } from "../../i18n/Tr";
import {
  getRankedMatchAnchor,
  rollRankedBotLoadout,
  type RankedBotLoadout,
} from "../../utils/matchmaking/rankedMatchmaking";
import { getProfileRankedCups } from "../../utils/rankedProgress";
import type { RankedDraftParticipant } from "../../utils/rankedMapPick";

const BRAWLER_PICK_SEC = 15;
const PET_PICK_SEC = 10;
const WAITING_LAUNCH_SEC = 4;
const AUTO_PICK_GRACE_SEC = 2;
const ICON_SIZE = 132;
const SLOT_ICON = 120;
const GRID_ROWS_H = ICON_SIZE * 2 + 10;
const GRID_ZONE_PAD = 20;
const PLACEHOLDER = `${publicAssetBase}images/ranked-player-placeholder.png`;

type GlobalPhase = "brawler" | "brawler_grace" | "pet" | "pet_grace" | "waiting" | "launching";

const MS_BRAWLER = BRAWLER_PICK_SEC * 1000;
const MS_BRAWLER_GRACE = AUTO_PICK_GRACE_SEC * 1000;
const MS_PET = PET_PICK_SEC * 1000;
const MS_PET_GRACE = AUTO_PICK_GRACE_SEC * 1000;
const MS_WAIT = WAITING_LAUNCH_SEC * 1000;
const T_PET_START = MS_BRAWLER + MS_BRAWLER_GRACE;
const T_PET_END = T_PET_START + MS_PET;
const T_WAIT_START = T_PET_END + MS_PET_GRACE;
const T_LAUNCH = T_WAIT_START + MS_WAIT;

function getGlobalTiming(elapsed: number): { phase: GlobalPhase; leftSec: number } {
  if (elapsed < MS_BRAWLER) {
    return { phase: "brawler", leftSec: Math.max(0, Math.ceil((MS_BRAWLER - elapsed) / 1000)) };
  }
  if (elapsed < T_PET_START) {
    return { phase: "brawler_grace", leftSec: Math.max(0, Math.ceil((T_PET_START - elapsed) / 1000)) };
  }
  if (elapsed < T_PET_END) {
    return { phase: "pet", leftSec: Math.max(0, Math.ceil((T_PET_END - elapsed) / 1000)) };
  }
  if (elapsed < T_WAIT_START) {
    return { phase: "pet_grace", leftSec: Math.max(0, Math.ceil((T_WAIT_START - elapsed) / 1000)) };
  }
  if (elapsed < T_LAUNCH) {
    return { phase: "waiting", leftSec: Math.max(0, Math.ceil((T_LAUNCH - elapsed) / 1000)) };
  }
  return { phase: "launching", leftSec: 0 };
}

type Team = "blue" | "red";

interface DraftSlot {
  id: string;
  name: string;
  team: Team;
  isPlayer: boolean;
  previewBrawlerId: string | null;
  lockedBrawlerId: string | null;
  previewPetId: string | null;
  lockedPetId: string | null;
  petConfirmed: boolean;
}

const SORT_CYCLE: BrawlerSortKey[] = ["rarity", "level", "name", "hp", "damage"];

/** Generic bot nicknames — not brawler names */
const BOT_NICKNAMES = ["NeonFox", "КиберВолк", "DarkNova", "IceStorm", "BlazePro"];

interface BotSchedule {
  brawlerId: string;
  previewBrawlerIds: string[];
  petId: string | null;
  loadout: RankedBotLoadout;
  previewStartMs: number;
  lockBrawlerAtMs: number;
  lockPetAtMs: number;
}

const PREVIEW_CYCLE_MS = 900;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildPreviewSequence(finalId: string, pool: string[]): string[] {
  const others = shuffle(pool.filter(id => id !== finalId));
  const hops = 3 + Math.floor(Math.random() * 3);
  const seq = others.slice(0, hops);
  seq.push(finalId);
  return seq;
}

function buildBotSchedules(unlockedIds: string[], profile: UserProfile): Record<string, BotSchedule> {
  const pool = shuffle(unlockedIds.length > 0 ? unlockedIds : BRAWLERS.map(b => b.id));
  const petPool = shuffle(PETS.map(p => p.id));
  const botIds = ["b0", "b1", "r0", "r1", "r2"];
  const usedBrawlers = new Set<string>();
  const usedPets = new Set<string>();
  const plans: Record<string, BotSchedule> = {};
  const anchor = getRankedMatchAnchor(profile);

  for (let i = 0; i < botIds.length; i++) {
    const id = botIds[i]!;
    let brawlerId = pool[i % pool.length]!;
    let guard = 0;
    while (usedBrawlers.has(brawlerId) && guard++ < pool.length) {
      brawlerId = pool[(i + guard) % pool.length]!;
    }
    usedBrawlers.add(brawlerId);

    let petId: string | null = null;
    if (Math.random() < 0.55) {
      const available = petPool.filter(pid => !usedPets.has(pid));
      if (available.length > 0) {
        petId = available[Math.floor(Math.random() * available.length)]!;
        usedPets.add(petId);
      }
    }

    const previewStartMs = 2500 + i * 1800 + Math.random() * 800;
    const lockBrawlerAtMs = previewStartMs + PREVIEW_CYCLE_MS * (3 + Math.floor(Math.random() * 3)) + 1200 + Math.random() * 2000;

    plans[id] = {
      brawlerId,
      previewBrawlerIds: buildPreviewSequence(brawlerId, pool),
      petId,
      loadout: rollRankedBotLoadout(anchor, i),
      previewStartMs,
      lockBrawlerAtMs: Math.min(lockBrawlerAtMs, MS_BRAWLER - 500),
      lockPetAtMs: T_PET_START + 1500 + i * 1200 + Math.random() * Math.max(800, MS_PET - 2500),
    };
  }
  return plans;
}

function buildRankedDraftRoster(
  slots: DraftSlot[],
  schedules: Record<string, BotSchedule>,
  profile: UserProfile,
): RankedDraftParticipant[] {
  const player = slots[0];
  const playerBrawlerId = player?.lockedBrawlerId ?? profile.selectedBrawlerId ?? "hana";
  const anchor = getRankedMatchAnchor(profile);
  const roster: RankedDraftParticipant[] = [];

  for (const slot of slots) {
    if (slot.isPlayer) {
      roster.push({
        slotId: slot.id,
        displayName: slot.name,
        team: slot.team,
        isPlayer: true,
        brawlerId: playerBrawlerId,
        petId: slot.lockedPetId,
        rankedCups: getProfileRankedCups(profile),
        powerLevel: profile.brawlerLevels[playerBrawlerId] ?? 1,
        stars: getBrawlerStarsCount(profile, playerBrawlerId),
      });
      continue;
    }
    const plan = schedules[slot.id];
    roster.push({
      slotId: slot.id,
      displayName: slot.name,
      team: slot.team,
      isPlayer: false,
      brawlerId: slot.lockedBrawlerId ?? plan?.brawlerId ?? "hana",
      petId: slot.lockedPetId ?? plan?.petId ?? null,
      rankedCups: plan?.loadout.rankedCups ?? anchor.rankedCups,
      powerLevel: plan?.loadout.powerLevel ?? anchor.powerLevel,
      stars: plan?.loadout.stars ?? anchor.stars,
    });
  }
  return roster;
}

function initSlots(playerName: string): DraftSlot[] {
  const nicks = shuffle(BOT_NICKNAMES);
  return [
    { id: "p0", name: playerName, team: "blue", isPlayer: true, previewBrawlerId: null, lockedBrawlerId: null, previewPetId: null, lockedPetId: null, petConfirmed: false },
    { id: "b0", name: nicks[0]!, team: "blue", isPlayer: false, previewBrawlerId: null, lockedBrawlerId: null, previewPetId: null, lockedPetId: null, petConfirmed: false },
    { id: "b1", name: nicks[1]!, team: "blue", isPlayer: false, previewBrawlerId: null, lockedBrawlerId: null, previewPetId: null, lockedPetId: null, petConfirmed: false },
    { id: "r0", name: nicks[2]!, team: "red", isPlayer: false, previewBrawlerId: null, lockedBrawlerId: null, previewPetId: null, lockedPetId: null, petConfirmed: false },
    { id: "r1", name: nicks[3]!, team: "red", isPlayer: false, previewBrawlerId: null, lockedBrawlerId: null, previewPetId: null, lockedPetId: null, petConfirmed: false },
    { id: "r2", name: nicks[4]!, team: "red", isPlayer: false, previewBrawlerId: null, lockedBrawlerId: null, previewPetId: null, lockedPetId: null, petConfirmed: false },
  ];
}

export interface RankedDraftScreenProps {
  pickedMode: GameMode;
  modeName: string;
  modeSubtitle: string;
  modeDesc: string;
  modePlayers: string;
  modeColor: string;
  onComplete: (brawlerId: string, petId: string | null, roster: RankedDraftParticipant[]) => void;
}

export default function RankedDraftScreen({
  pickedMode,
  modeName,
  modeSubtitle,
  modeDesc,
  modePlayers,
  modeColor,
  onComplete,
}: RankedDraftScreenProps) {
  const { t } = useI18n();
  const profile = getCurrentProfile()!;
  const unlocked = useMemo(() => new Set(profile.unlockedBrawlers ?? []), [profile]);
  const ownedPets = useMemo(() => new Set(profile.unlockedPets ?? []), [profile]);

  const draftStartRef = useRef(Date.now());
  const completedRef = useRef(false);
  const botSchedulesRef = useRef<Record<string, BotSchedule>>({});

  const [globalPhase, setGlobalPhase] = useState<GlobalPhase>("brawler");
  const [timer, setTimer] = useState(BRAWLER_PICK_SEC);
  const [slots, setSlots] = useState<DraftSlot[]>(() => initSlots(profile.username));
  const [sortKey, setSortKey] = useState<BrawlerSortKey>("rarity");
  const [showModeInfo, setShowModeInfo] = useState(false);
  const modeInfo = useMemo(() => localizedModeInfo(getModeInfo(pickedMode)), [pickedMode]);
  const [playerPreviewBrawler, setPlayerPreviewBrawler] = useState<string | null>(null);
  const [playerPreviewPet, setPlayerPreviewPet] = useState<string | null>(null);
  const brawlerAutoDoneRef = useRef(false);
  const petAutoDoneRef = useRef(false);
  const slotsRef = useRef(slots);
  const onCompleteRef = useRef(onComplete);
  const forceAutoPickBrawlersRef = useRef<() => void>(() => {});
  const forceAutoPickPetsRef = useRef<() => void>(() => {});
  slotsRef.current = slots;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const ids = BRAWLERS.filter(b => unlocked.has(b.id)).map(b => b.id);
    botSchedulesRef.current = buildBotSchedules(ids, profile);
  }, [unlocked, profile]);

  const playerSlot = slots[0]!;
  const playerBrawlerLocked = !!playerSlot.lockedBrawlerId;
  const playerPetConfirmed = playerSlot.petConfirmed;

  const takenBrawlers = useMemo(() => {
    const s = new Set<string>();
    for (const slot of slots) {
      if (slot.lockedBrawlerId) s.add(slot.lockedBrawlerId);
    }
    return s;
  }, [slots]);

  const takenPets = useMemo(() => {
    const s = new Set<string>();
    for (const slot of slots) {
      if (slot.petConfirmed && slot.lockedPetId) s.add(slot.lockedPetId);
    }
    return s;
  }, [slots]);

  const sortedBrawlers = useMemo(
    () => sortBrawlers(BRAWLERS, sortKey, profile.brawlerLevels),
    [sortKey, profile.brawlerLevels],
  );

  const sortedPets = useMemo(
    () => [...PETS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const brawlerMeta = useCallback((id: string) => {
    const trophies = getBrawlerTrophies(profile, id);
    return {
      level: profile.brawlerLevels[id] ?? 1,
      rank: getBrawlerRank(trophies),
      stars: getBrawlerStarsCount(profile, id),
    };
  }, [profile]);

  const isBrawlerPickPhase = globalPhase === "brawler";
  const isPetPickPhase = globalPhase === "pet";
  const showBrawlerGrid = globalPhase === "brawler" || globalPhase === "brawler_grace";
  const showPetGrid = globalPhase === "pet" || globalPhase === "pet_grace";

  const gridOverlay = useCallback((brawlerId: string): BrawlerSquareOverlay => {
    if (!unlocked.has(brawlerId)) return "none";
    if (playerPreviewBrawler === brawlerId && !playerBrawlerLocked && isBrawlerPickPhase) return "preview";
    for (const slot of slots) {
      if (slot.lockedBrawlerId === brawlerId) {
        return slot.team === "red" ? "locked-red" : "locked-blue";
      }
    }
    if (takenBrawlers.has(brawlerId)) return "banned";
    return "none";
  }, [playerPreviewBrawler, playerBrawlerLocked, isBrawlerPickPhase, slots, takenBrawlers, unlocked]);

  const handleBrawlerClick = (id: string) => {
    if (!isBrawlerPickPhase || playerBrawlerLocked || !unlocked.has(id) || takenBrawlers.has(id)) return;
    if (playerPreviewBrawler === id) {
      handleBrawlerConfirm(id);
      return;
    }
    setPlayerPreviewBrawler(id);
    setSlots(prev => prev.map((s, i) => i === 0 ? { ...s, previewBrawlerId: id } : s));
  };

  const handleBrawlerConfirm = (id: string) => {
    if (!isBrawlerPickPhase || playerBrawlerLocked || !unlocked.has(id) || takenBrawlers.has(id)) return;
    setPlayerPreviewBrawler(id);
    setSlots(prev => prev.map((s, i) => i === 0
      ? { ...s, previewBrawlerId: id, lockedBrawlerId: id }
      : s));
  };

  const handlePetClick = (id: string | null) => {
    if (!isPetPickPhase || playerPetConfirmed) return;
    if (id !== null && (!ownedPets.has(id) || takenPets.has(id))) return;
    if (playerPreviewPet === id) {
      handlePetConfirm(id);
      return;
    }
    setPlayerPreviewPet(id);
    setSlots(prev => prev.map((s, i) => i === 0 ? { ...s, previewPetId: id } : s));
  };

  const handlePetConfirm = (id: string | null) => {
    if (!isPetPickPhase || playerPetConfirmed) return;
    if (id !== null && (!ownedPets.has(id) || takenPets.has(id))) return;
    setSlots(prev => prev.map((s, i) => i === 0
      ? { ...s, previewPetId: id, lockedPetId: id, petConfirmed: true }
      : s));
    setPlayerPreviewPet(id);
  };

  const cycleSort = () => {
    const idx = SORT_CYCLE.indexOf(sortKey);
    setSortKey(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]!);
  };

  const forceAutoPickBrawlers = useCallback(() => {
    let playerPick: string | null = null;
    setSlots(prev => {
      const taken = new Set<string>();
      prev.forEach(s => { if (s.lockedBrawlerId) taken.add(s.lockedBrawlerId); });
      return prev.map(slot => {
        if (slot.lockedBrawlerId) return slot;
        const available = BRAWLERS
          .filter(b => unlocked.has(b.id) && !taken.has(b.id))
          .map(b => b.id);
        const fallback = BRAWLERS.filter(b => unlocked.has(b.id)).map(b => b.id);
        const pool = available.length > 0 ? available : fallback;
        const pick = pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? "hana";
        taken.add(pick);
        if (slot.isPlayer) playerPick = pick;
        return { ...slot, previewBrawlerId: pick, lockedBrawlerId: pick };
      });
    });
    if (playerPick) setPlayerPreviewBrawler(playerPick);
  }, [unlocked]);

  const forceAutoPickPets = useCallback(() => {
    let playerPick: string | null = null;
    setSlots(prev => {
      const taken = new Set<string>();
      prev.forEach(s => { if (s.petConfirmed && s.lockedPetId) taken.add(s.lockedPetId); });
      return prev.map(slot => {
        if (slot.petConfirmed) return slot;
        const available = PETS
          .filter(p => {
            if (slot.isPlayer) return ownedPets.has(p.id) && !taken.has(p.id);
            return !taken.has(p.id);
          })
          .map(p => p.id);
        const pick = available.length > 0
          ? available[Math.floor(Math.random() * available.length)]!
          : null;
        if (pick) taken.add(pick);
        if (slot.isPlayer) playerPick = pick;
        return { ...slot, previewPetId: pick, lockedPetId: pick, petConfirmed: true };
      });
    });
    setPlayerPreviewPet(playerPick);
  }, [ownedPets]);

  forceAutoPickBrawlersRef.current = forceAutoPickBrawlers;
  forceAutoPickPetsRef.current = forceAutoPickPets;

  // Global draft clock — one shared timeline, interval must not restart on re-renders
  useEffect(() => {
    draftStartRef.current = Date.now();
    brawlerAutoDoneRef.current = false;
    petAutoDoneRef.current = false;
    completedRef.current = false;
    setGlobalPhase("brawler");
    setTimer(BRAWLER_PICK_SEC);

    const tick = () => {
      const elapsed = Date.now() - draftStartRef.current;
      const timing = getGlobalTiming(elapsed);
      setGlobalPhase(timing.phase);
      setTimer(timing.leftSec);

      if (elapsed >= T_PET_START && !brawlerAutoDoneRef.current) {
        brawlerAutoDoneRef.current = true;
        forceAutoPickBrawlersRef.current();
      }
      if (elapsed >= T_WAIT_START && !petAutoDoneRef.current) {
        petAutoDoneRef.current = true;
        forceAutoPickPetsRef.current();
      }
      if (elapsed >= T_LAUNCH && !completedRef.current) {
        completedRef.current = true;
        setGlobalPhase("launching");
        const ps = slotsRef.current[0];
        if (ps) {
          const roster = buildRankedDraftRoster(slotsRef.current, botSchedulesRef.current, profile);
          onCompleteRef.current(ps.lockedBrawlerId ?? "hana", ps.lockedPetId, roster);
        }
      }
    };

    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, []);

  // Scheduled bot picks — visible hover cycles, then lock
  useEffect(() => {
    if (globalPhase === "launching") return;
    const iv = setInterval(() => {
      const elapsed = Date.now() - draftStartRef.current;
      const plans = botSchedulesRef.current;

      setSlots(prev => {
        const taken = new Set<string>();
        prev.forEach(s => { if (s.lockedBrawlerId) taken.add(s.lockedBrawlerId); });

        return prev.map(slot => {
          if (slot.isPlayer) return slot;
          const plan = plans[slot.id];
          if (!plan) return slot;

          let next = { ...slot };

          if (elapsed < T_WAIT_START && !next.lockedBrawlerId) {
            if (elapsed >= plan.previewStartMs && elapsed < plan.lockBrawlerAtMs) {
              const hop = Math.floor((elapsed - plan.previewStartMs) / PREVIEW_CYCLE_MS);
              const previewId = plan.previewBrawlerIds[Math.min(hop, plan.previewBrawlerIds.length - 1)]!;
              if (slot.team === "blue") {
                next.previewBrawlerId = previewId;
              }
            }
            if (elapsed >= plan.lockBrawlerAtMs && !taken.has(plan.brawlerId)) {
              next.previewBrawlerId = plan.brawlerId;
              next.lockedBrawlerId = plan.brawlerId;
              taken.add(plan.brawlerId);
            }
          }

          if (elapsed >= T_PET_START && elapsed < T_WAIT_START && !next.petConfirmed && elapsed >= plan.lockPetAtMs) {
            const takenPetsNow = new Set<string>();
            prev.forEach(s => { if (s.petConfirmed && s.lockedPetId) takenPetsNow.add(s.lockedPetId); });
            const petId = plan.petId && !takenPetsNow.has(plan.petId) ? plan.petId : null;
            next.previewPetId = petId;
            next.lockedPetId = petId;
            next.petConfirmed = true;
          }

          return next;
        });
      });
    }, 250);
    return () => clearInterval(iv);
  }, [globalPhase]);

  const playerWaiting =
    (isBrawlerPickPhase && playerBrawlerLocked)
    || (globalPhase === "brawler_grace")
    || (isPetPickPhase && playerPetConfirmed)
    || (globalPhase === "pet_grace")
    || globalPhase === "waiting";

  const headerText = globalPhase === "launching"
    ? t("ranked.launching")
    : playerWaiting || globalPhase === "waiting"
      ? t("ranked.draft.waitingOthers")
      : isBrawlerPickPhase && !playerBrawlerLocked
        ? t("ranked.draft.yourTurn")
        : isPetPickPhase && !playerPetConfirmed
          ? t("ranked.draft.pickPet")
          : t("ranked.draft.waitingOthers");

  const showTimer = globalPhase !== "launching";
  const timerColor =
    globalPhase === "waiting" ? "#69F0AE"
      : globalPhase === "brawler_grace" || globalPhase === "pet_grace" ? "#FF8A80"
        : "#FFD54F";

  const phaseSubtitle = showBrawlerGrid
    ? t("ranked.pickBrawler")
    : showPetGrid
      ? t("ranked.pickPet")
      : globalPhase === "waiting"
        ? t("ranked.draft.waitingOthers")
        : "";

  const petOverlay = (petId: string | null): PetCardOverlay => {
    if (petId === null) {
      if (playerPreviewPet === null && !playerPetConfirmed && isPetPickPhase) return "preview";
      if (playerPetConfirmed && playerSlot.lockedPetId === null) return "locked-blue";
      return "none";
    }
    if (!ownedPets.has(petId)) return "none";
    if (playerPreviewPet === petId && !playerPetConfirmed && isPetPickPhase) return "preview";
    for (const slot of slots) {
      if (slot.petConfirmed && slot.lockedPetId === petId) {
        return slot.team === "red" ? "locked-red" : "locked-blue";
      }
    }
    if (takenPets.has(petId)) return "banned";
    return "none";
  };

  const renderPetCell = (pet: PetDef | null) => {
    const petId = pet?.id ?? null;
    const overlay = petOverlay(petId);
    const selected = playerPreviewPet === petId || (playerPetConfirmed && playerSlot.lockedPetId === petId);
    const owned = pet ? ownedPets.has(pet.id) : true;
    const blocked = !owned || overlay === "locked-red" || overlay === "locked-blue" || overlay === "banned";

    if (!pet) {
      return (
        <PetSkipCard
          key="__skip__"
          label={t("ranked.skipPet")}
          selected={selected}
          overlay={overlay}
          compact
          compactSize={ICON_SIZE}
          onClick={() => handlePetClick(null)}
          onDoubleClick={() => handlePetConfirm(null)}
        />
      );
    }

    return (
      <PetGridCard
        key={pet.id}
        pet={pet}
        owned={owned}
        selected={selected && owned}
        compact
        compactSize={ICON_SIZE}
        displayName={getPetDisplayName(pet.id, petName(pet.id, pet.name), profile)}
        isEquipped={profile.equippedPetId === pet.id}
        equippedLabel={t("pets.equippedBadge")}
        overlay={overlay}
        onClick={blocked ? undefined : () => handlePetClick(pet.id)}
        onDoubleClick={blocked ? undefined : () => handlePetConfirm(pet.id)}
        style={blocked ? { cursor: "default", opacity: overlay === "banned" ? 0.55 : 1 } : undefined}
      />
    );
  };

  const slotBrawlerId = (slot: DraftSlot) => {
    if (slot.lockedBrawlerId) return slot.lockedBrawlerId;
    if (slot.team === "blue") return slot.previewBrawlerId;
    return null;
  };

  const renderTeamSlotIcon = (brawlerId: string) => (
    <BrawlerSquareIcon
      brawlerId={brawlerId}
      size={SLOT_ICON}
      {...brawlerMeta(brawlerId)}
      showMeta
      showName
      static
      overlay="none"
    />
  );

  const renderTeamBar = () => {
    const blue = slots.filter(s => s.team === "blue");
    const red = slots.filter(s => s.team === "red");
    return (
      <div style={{ display: "flex", width: "100%", minHeight: SLOT_ICON + 36, flexShrink: 0 }}>
        <div style={{
          flex: 1, background: "linear-gradient(180deg, #0D47A1 0%, #1565C0 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 12px",
        }}>
          {blue.map(slot => {
            const bid = slotBrawlerId(slot);
            return (
              <div key={slot.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {bid ? renderTeamSlotIcon(bid) : (
                  <img src={PLACEHOLDER} alt="" style={{ width: SLOT_ICON, height: SLOT_ICON, borderRadius: 0, objectFit: "cover" }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)", maxWidth: 100, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {slot.name}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{
          width: 56, flexShrink: 0, background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 900, color: "#fff", fontStyle: "italic",
        }}>
          VS
        </div>
        <div style={{
          flex: 1, background: "linear-gradient(180deg, #B71C1C 0%, #D32F2F 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 12px",
        }}>
          {red.map(slot => (
            <div key={slot.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {slot.lockedBrawlerId ? renderTeamSlotIcon(slot.lockedBrawlerId) : (
                <img src={PLACEHOLDER} alt="" style={{ width: SLOT_ICON, height: SLOT_ICON, borderRadius: 0, objectFit: "cover" }} />
              )}
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)", maxWidth: 100, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {slot.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%",
      backgroundImage: `url("${publicAssetBase}images/ranked-draft-bg.png")`,
      backgroundSize: "cover", backgroundPosition: "center",
    }}>
      <style>{`
        @keyframes rankedDraftPulse {
          0%, 100% { filter: brightness(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
          50% { filter: brightness(1.18); box-shadow: 0 0 18px rgba(255,255,255,0.55); }
        }
      `}</style>

      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        padding: "12px 16px 8px", flexShrink: 0, gap: 12,
      }}>
        <button
          type="button"
          onClick={() => setShowModeInfo(true)}
          className="ui-btn ui-btn--shear"
          style={{
            position: "relative", overflow: "visible", height: 76, minHeight: 76,
            boxSizing: "border-box", padding: "8px 18px", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, minWidth: 280, fontFamily: "inherit",
            border: "none", background: "transparent",
            ["--ui-shear-text" as string]: "#ffffff",
            ["--ui-shear-fill" as string]: `linear-gradient(135deg, ${modeColor}40, rgba(8,4,24,0.78))`,
            ["--ui-shear-border" as string]: modeColor,
            ["--ui-shear-shadow" as string]: `0 8px 28px ${modeColor}55`,
            ["--ui-shear-blur" as string]: "blur(14px) saturate(1.2)",
          }}
        >
          <ModeIconImg modeId={pickedMode} alt={modeName} size={52} color={modeColor} />
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={{ display: "block", color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: 1 }}><Tr id="common.mode" /></span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>{modeName}</span>
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{modeSubtitle}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={cycleSort}
          title={t(`ranked.draft.sort.${sortKey}`)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8,
            color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 11,
          }}
        >
          <span style={{ fontSize: 16 }}>⏷</span>
          {t(`ranked.draft.sort.${sortKey}`)}
        </button>
      </div>

      {showModeInfo && (
        <ModeInfoModal mode={modeInfo} onClose={() => setShowModeInfo(false)} />
      )}

      <div style={{ textAlign: "center", padding: "4px 16px 10px", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5, marginBottom: 4 }}>
          {phaseSubtitle}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 2, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
          {headerText}
        </div>
        {showTimer && (
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: timerColor }}>
            {globalPhase === "launching"
              ? t("ranked.launching")
              : `${timer} $<Tr id="ranked.draft.secShort" />`}
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          height: GRID_ROWS_H + GRID_ZONE_PAD,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "8px 16px 12px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{
          display: "grid",
          gridTemplateRows: `repeat(2, ${ICON_SIZE}px)`,
          gridAutoFlow: "column",
          gap: 10,
          width: "max-content",
          height: GRID_ROWS_H,
          alignItems: "center",
        }}>
          {showPetGrid ? (
            <>
              {renderPetCell(null)}
              {sortedPets.map(p => renderPetCell(p))}
            </>
          ) : (
            sortedBrawlers.map(b => {
              const isUnlocked = unlocked.has(b.id);
              const meta = brawlerMeta(b.id);
              const ov = gridOverlay(b.id);
              return (
                <BrawlerSquareIcon
                  key={b.id}
                  brawlerId={b.id}
                  size={ICON_SIZE}
                  {...meta}
                  overlay={ov}
                  unlocked={isUnlocked}
                  onClick={isUnlocked ? () => handleBrawlerClick(b.id) : undefined}
                  onDoubleClick={isUnlocked ? () => handleBrawlerConfirm(b.id) : undefined}
                />
              );
            })
          )}
        </div>
      </div>

      {renderTeamBar()}
    </div>
  );
}
