import { getCurrentProfile, getBattleHistory, type BattleRecord, type BattleHistoryParticipant } from "./localStorageAPI";
import { normalizePlayerIdQuery } from "./playerId";
import { getFeedPeriodEnd, getFeedPeriodStart, syncFeedContestPeriod } from "./battleFeedContest";

const FEED_KEY = "clash_battle_feed_v1";
export const FEED_POST_TTL_MS = 5 * 24 * 60 * 60 * 1000;

export interface BattleFeedPost {
  id: string;
  authorPlayerId: string;
  authorUsername: string;
  authorProfileIconId?: string;
  replayId: string;
  caption: string;
  mode: string;
  brawlerId: string;
  won: boolean;
  trophyDelta: number;
  likes: string[];
  createdAt: number;
  expiresAt: number;
  /** Snapshot for history-style feed cards */
  battleTs?: number;
  teams?: BattleHistoryParticipant[];
  scoreBlue?: number;
  scoreRed?: number;
  durationSec?: number;
  place?: number;
  totalPlayers?: number;
  showdownFormat?: "solo" | "duo" | "trio";
  bossId?: string;
  bossLevel?: number;
}

function loadRaw(): BattleFeedPost[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FEED_KEY) || "[]") as BattleFeedPost[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveRaw(posts: BattleFeedPost[]): void {
  localStorage.setItem(FEED_KEY, JSON.stringify(posts));
}

export function purgeExpiredFeedPosts(now = Date.now()): BattleFeedPost[] {
  const synced = syncFeedContestPeriod(loadRaw(), now);
  saveRaw(synced);
  return synced;
}

export function getBattleFeed(): BattleFeedPost[] {
  return purgeExpiredFeedPosts().sort((a, b) => b.createdAt - a.createdAt);
}

export function getMyBattleFeedPosts(playerId?: string | null): BattleFeedPost[] {
  if (!playerId) return [];
  const pid = normalizePlayerIdQuery(playerId);
  return getBattleFeed().filter(p => normalizePlayerIdQuery(p.authorPlayerId) === pid);
}

export function isMyFeedPost(post: BattleFeedPost, playerId?: string | null): boolean {
  if (!playerId) return false;
  return normalizePlayerIdQuery(post.authorPlayerId) === normalizePlayerIdQuery(playerId);
}

export function getFeedPostById(id: string): BattleFeedPost | null {
  return getBattleFeed().find((p) => p.id === id) ?? null;
}

export function publishFeedPost(
  replayId: string,
  caption: string,
  record?: BattleRecord,
): { success: boolean; error?: string; post?: BattleFeedPost } {
  const profile = getCurrentProfile();
  if (!profile?.playerId) return { success: false, error: "Not logged in" };

  const battle =
    record ??
    getBattleHistory().find((r) => r.replayId === replayId);
  if (!battle?.replayId) {
    return { success: false, error: "Replay not found" };
  }

  const trimmed = caption.trim();
  if (trimmed.length > 280) {
    return { success: false, error: "Caption too long" };
  }

  const now = Date.now();
  const periodStart = getFeedPeriodStart(now);
  const post: BattleFeedPost = {
    id: `feed_${now}_${Math.random().toString(36).slice(2, 8)}`,
    authorPlayerId: normalizePlayerIdQuery(profile.playerId),
    authorUsername: profile.username,
    authorProfileIconId: profile.profileIconId,
    replayId: battle.replayId,
    caption: trimmed,
    mode: battle.mode,
    brawlerId: battle.brawlerId,
    won: battle.won,
    trophyDelta: battle.trophyDelta,
    likes: [],
    createdAt: now,
    expiresAt: getFeedPeriodEnd(periodStart),
    battleTs: battle.ts,
    teams: battle.teams,
    scoreBlue: battle.scoreBlue,
    scoreRed: battle.scoreRed,
    durationSec: battle.durationSec,
    place: battle.place,
    totalPlayers: battle.totalPlayers,
    showdownFormat: battle.showdownFormat,
    bossId: battle.bossId,
    bossLevel: battle.bossLevel,
  };

  const posts = purgeExpiredFeedPosts(now);
  saveRaw([post, ...posts]);
  return { success: true, post };
}

export function toggleFeedPostLike(postId: string): {
  success: boolean;
  liked?: boolean;
  count?: number;
  error?: string;
} {
  const profile = getCurrentProfile();
  if (!profile?.playerId) return { success: false, error: "Not logged in" };

  const pid = normalizePlayerIdQuery(profile.playerId);
  const posts = purgeExpiredFeedPosts();
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx < 0) return { success: false, error: "Post not found" };

  const post = posts[idx];
  const set = new Set(post.likes.map(normalizePlayerIdQuery));
  let liked: boolean;
  if (set.has(pid)) {
    set.delete(pid);
    liked = false;
  } else {
    set.add(pid);
    liked = true;
  }
  posts[idx] = { ...post, likes: [...set] };
  saveRaw(posts);
  return { success: true, liked, count: posts[idx].likes.length };
}

export function hasLikedFeedPost(post: BattleFeedPost, playerId?: string | null): boolean {
  if (!playerId) return false;
  const pid = normalizePlayerIdQuery(playerId);
  return post.likes.some((id) => normalizePlayerIdQuery(id) === pid);
}

export function feedTimeLeftMs(_post: BattleFeedPost, now = Date.now()): number {
  return Math.max(0, getFeedPeriodEnd(getFeedPeriodStart(now)) - now);
}

export function updateFeedPostCaption(
  postId: string,
  caption: string,
): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile?.playerId) return { success: false, error: "Not logged in" };

  const trimmed = caption.trim();
  if (trimmed.length > 280) return { success: false, error: "Caption too long" };

  const pid = normalizePlayerIdQuery(profile.playerId);
  const posts = purgeExpiredFeedPosts();
  const idx = posts.findIndex(p => p.id === postId);
  if (idx < 0) return { success: false, error: "Post not found" };
  if (normalizePlayerIdQuery(posts[idx].authorPlayerId) !== pid) {
    return { success: false, error: "Not your post" };
  }

  posts[idx] = { ...posts[idx], caption: trimmed };
  saveRaw(posts);
  return { success: true };
}

export function deleteFeedPost(postId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile?.playerId) return { success: false, error: "Not logged in" };

  const pid = normalizePlayerIdQuery(profile.playerId);
  const posts = purgeExpiredFeedPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return { success: false, error: "Post not found" };
  if (normalizePlayerIdQuery(post.authorPlayerId) !== pid) {
    return { success: false, error: "Not your post" };
  }

  saveRaw(posts.filter(p => p.id !== postId));
  return { success: true };
}
