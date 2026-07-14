import type { GiftItem } from "./gifts";
import { sendGiftToPlayer } from "./gifts";
import { findProfileStorageKeyByPlayerId, getCurrentUsername } from "./localStorageAPI";
import { FEED_POST_TTL_MS, type BattleFeedPost } from "./battleFeed";

const CONTEST_KEY = "clash_feed_contest_v1";
const TEST_GIFT_KEY = "clash_feed_contest_test_gift";

export const FEED_CONTEST_REWARDS = [
  { coins: 2000, powerPoints: 100, gems: 100 },
  { coins: 1400, powerPoints: 70, gems: 70 },
  { coins: 980, powerPoints: 49, gems: 49 },
] as const;

export interface FeedContestEntry {
  place: 1 | 2 | 3;
  postId: string;
  authorPlayerId: string;
  authorUsername: string;
  authorProfileIconId?: string;
  replayId: string;
  likes: number;
  caption: string;
  mode: string;
  brawlerId: string;
  createdAt: number;
}

export interface FeedContestPeriodArchive {
  periodStart: number;
  entries: FeedContestEntry[];
}

interface FeedContestState {
  settledPeriodStarts: number[];
  archive: FeedContestPeriodArchive[];
}

function loadState(): FeedContestState {
  try {
    const raw = JSON.parse(localStorage.getItem(CONTEST_KEY) || "{}");
    return {
      settledPeriodStarts: Array.isArray(raw.settledPeriodStarts) ? raw.settledPeriodStarts : [],
      archive: Array.isArray(raw.archive) ? raw.archive : [],
    };
  } catch {
    return { settledPeriodStarts: [], archive: [] };
  }
}

function saveState(state: FeedContestState): void {
  localStorage.setItem(CONTEST_KEY, JSON.stringify(state));
}

export function getFeedPeriodStart(now = Date.now()): number {
  return Math.floor(now / FEED_POST_TTL_MS) * FEED_POST_TTL_MS;
}

export function getFeedPeriodEnd(periodStart = getFeedPeriodStart()): number {
  return periodStart + FEED_POST_TTL_MS;
}

export function getFeedContestTimeLeftMs(now = Date.now()): number {
  return Math.max(0, getFeedPeriodEnd(getFeedPeriodStart(now)) - now);
}

function rewardItemsForPlace(place: 1 | 2 | 3): GiftItem[] {
  const r = FEED_CONTEST_REWARDS[place - 1];
  return [
    { kind: "coins", amount: r.coins },
    { kind: "powerPoints", amount: r.powerPoints },
    { kind: "gems", amount: r.gems },
  ];
}

function grantContestReward(post: BattleFeedPost, place: 1 | 2 | 3): void {
  const storageKey = findProfileStorageKeyByPlayerId(post.authorPlayerId);
  if (!storageKey) return;
  const titles = ["1-е", "2-е", "3-е"];
  sendGiftToPlayer({
    storageKey,
    items: rewardItemsForPlace(place),
    message: `Награда за ${titles[place - 1]} место в конкурсе ленты! Лайков: ${post.likes.length}`,
  });
}

function buildEntry(post: BattleFeedPost, place: 1 | 2 | 3): FeedContestEntry {
  return {
    place,
    postId: post.id,
    authorPlayerId: post.authorPlayerId,
    authorUsername: post.authorUsername,
    authorProfileIconId: post.authorProfileIconId,
    replayId: post.replayId,
    likes: post.likes.length,
    caption: post.caption,
    mode: post.mode,
    brawlerId: post.brawlerId,
    createdAt: post.createdAt,
  };
}

export function settleFeedPeriod(periodStart: number, posts: BattleFeedPost[]): FeedContestPeriodArchive | null {
  const state = loadState();
  if (state.settledPeriodStarts.includes(periodStart)) {
    return state.archive.find(a => a.periodStart === periodStart) ?? null;
  }

  const periodPosts = posts.filter(p => getFeedPeriodStart(p.createdAt) === periodStart);
  const sorted = [...periodPosts].sort((a, b) =>
    b.likes.length - a.likes.length || b.createdAt - a.createdAt,
  );
  const top3 = sorted.slice(0, 3);
  const entries: FeedContestEntry[] = [];

  top3.forEach((post, i) => {
    const place = (i + 1) as 1 | 2 | 3;
    if (post.likes.length <= 0 && place > 1) return;
    entries.push(buildEntry(post, place));
    grantContestReward(post, place);
  });

  const archiveEntry: FeedContestPeriodArchive = { periodStart, entries };
  const monthAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
  state.settledPeriodStarts.push(periodStart);
  state.archive = [archiveEntry, ...state.archive.filter(a => a.periodStart !== periodStart)]
    .filter(a => a.periodStart >= monthAgo)
    .sort((a, b) => b.periodStart - a.periodStart);
  saveState(state);
  return archiveEntry;
}

/** End expired period, purge old posts, return posts for the active period. */
export function syncFeedContestPeriod(posts: BattleFeedPost[], now = Date.now()): BattleFeedPost[] {
  if (posts.length === 0) return posts;

  const currentPeriod = getFeedPeriodStart(now);
  const postPeriod = getFeedPeriodStart(posts[0].createdAt);
  const periodEnded = now >= getFeedPeriodEnd(postPeriod);

  if (postPeriod < currentPeriod || periodEnded) {
    settleFeedPeriod(postPeriod, posts);
    return posts.filter(
      p => getFeedPeriodStart(p.createdAt) === currentPeriod && getFeedPeriodEnd(currentPeriod) > now,
    );
  }

  return posts.filter(p => getFeedPeriodStart(p.createdAt) === currentPeriod);
}

export function getFeedContestLeaders(posts: BattleFeedPost[]): BattleFeedPost[] {
  return [...posts].sort((a, b) => b.likes.length - a.likes.length || b.createdAt - a.createdAt);
}

export function getFeedContestMonthlyArchive(now = Date.now()): FeedContestPeriodArchive[] {
  const monthAgo = now - 31 * 24 * 60 * 60 * 1000;
  return loadState().archive.filter(a => a.periodStart >= monthAgo);
}

/** One-time test gift for the current user (feed contest reward preview). */
export function sendFeedContestTestGiftIfNeeded(): boolean {
  const username = getCurrentUsername();
  if (!username) return false;
  const flagKey = `${TEST_GIFT_KEY}_${username}`;
  if (localStorage.getItem(flagKey)) return false;

  const r = sendGiftToPlayer({
    storageKey: username,
    items: rewardItemsForPlace(2),
    message: "Тестовая награда за 2-е место в конкурсе ленты — проверка подарка и анимации!",
  });
  if (r.success) localStorage.setItem(flagKey, "1");
  return r.success;
}
