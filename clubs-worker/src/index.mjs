// ─────────────────────────────────────────────────────────────────────────────
// Starfall Clubs — Cloudflare Worker (authoritative club store on D1).
//
// The server holds the authoritative club document and validates every mutation
// against the actor's membership and rank — clients cannot kick/promote/edit a
// club they don't have rights in, regardless of what they send. Identity is the
// player's username/playerId (full cryptographic player auth lands with the
// Supabase account migration; until then operations are still permission-checked
// against the stored document and rate-limited per IP).
// ─────────────────────────────────────────────────────────────────────────────

const NAME_MAX = 20;
const DESC_MAX = 100;
const CHAT_MAX = 200;
const MEMBERS_MAX = 50;
const CHAT_KEEP = 200;
const CYCLE_MS = 5 * 24 * 60 * 60 * 1000;

const RANK_ORDER = ["junior", "middle", "senior", "president", "owner"];
const RANK_META = {
  junior:    { canEditClub: false, canPromote: false, canKick: false, canApproveJoin: false, canInvite: false },
  middle:    { canEditClub: false, canPromote: false, canKick: false, canApproveJoin: false, canInvite: true },
  senior:    { canEditClub: false, canPromote: false, canKick: true,  canApproveJoin: true,  canInvite: true },
  president: { canEditClub: false, canPromote: true,  canKick: true,  canApproveJoin: true,  canInvite: true },
  owner:     { canEditClub: true,  canPromote: true,  canKick: true,  canApproveJoin: true,  canInvite: true },
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "cache-control": "no-store",
      ...extra,
    },
  });

const uid = (p = "c") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const now = () => Date.now();
const clean = (s, max) => String(s ?? "").trim().slice(0, max);
const rankIndex = (r) => RANK_ORDER.indexOf(r);
const meta = (r) => RANK_META[r] || RANK_META.junior;

function sys(text) { return { id: uid("m"), sentAt: now(), username: "", text, system: true }; }
function pruneChat(chat) { return chat.length > CHAT_KEEP ? chat.slice(-CHAT_KEEP) : chat; }
function member(club, username) { return (club.members || []).find((m) => m.username === username) || null; }
function totalTrophies(club) { return (club.members || []).reduce((s, m) => s + (m.trophies || 0), 0); }

async function rateLimit(env, key, limit, windowMs) {
  const k = `${key}`;
  const t = now();
  const row = await env.DB.prepare("SELECT count, window_end FROM rate_limits WHERE k=?").bind(k).first();
  if (!row || t > row.window_end) {
    await env.DB.prepare("INSERT INTO rate_limits (k,count,window_end) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET count=1,window_end=?")
      .bind(k, 1, t + windowMs, t + windowMs).run();
    return true;
  }
  if (row.count >= limit) return false;
  await env.DB.prepare("UPDATE rate_limits SET count=count+1 WHERE k=?").bind(k).run();
  return true;
}

async function loadClub(env, id) {
  const row = await env.DB.prepare("SELECT data FROM clubs WHERE id=?").bind(id).first();
  return row ? JSON.parse(row.data) : null;
}

async function saveClub(env, club) {
  club.updatedAt = now();
  club.chat = pruneChat(club.chat || []);
  const tt = totalTrophies(club);
  await env.DB.prepare(
    `INSERT INTO clubs (id,name,name_lower,description,type,member_count,total_trophies,created_at,updated_at,data)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_lower=excluded.name_lower,description=excluded.description,
       type=excluded.type,member_count=excluded.member_count,total_trophies=excluded.total_trophies,
       updated_at=excluded.updated_at,data=excluded.data`,
  ).bind(
    club.id, club.name, club.name.toLowerCase(), club.description || "", club.type || "open",
    (club.members || []).length, tt, club.createdAt || now(), club.updatedAt, JSON.stringify(club),
  ).run();
  return club;
}

async function deleteClub(env, id) {
  await env.DB.prepare("DELETE FROM clubs WHERE id=?").bind(id).run();
  await env.DB.prepare("UPDATE memberships SET club_id=NULL, updated_at=? WHERE club_id=?").bind(now(), id).run();
}

async function setMembership(env, username, playerId, clubId) {
  await env.DB.prepare(
    `INSERT INTO memberships (username,player_id,club_id,updated_at) VALUES (?,?,?,?)
     ON CONFLICT(username) DO UPDATE SET player_id=excluded.player_id, club_id=excluded.club_id, updated_at=excluded.updated_at`,
  ).bind(username, playerId || null, clubId, now()).run();
}

async function getMembership(env, username) {
  return env.DB.prepare("SELECT club_id FROM memberships WHERE username=?").bind(username).first();
}

function defaultBossRaid() {
  return { bossId: null, leaderPlayerId: null, leaderUsername: null, partyCode: null, joinedPlayerIds: [], updatedAt: 0 };
}

function ensureCycle(club) {
  if (!club.cycleStartedAt) { club.cycleStartedAt = now(); club.cycleId = club.cycleId || 1; }
  if (now() - club.cycleStartedAt >= CYCLE_MS) {
    club.cycleStartedAt = now();
    club.cycleId = (club.cycleId || 1) + 1;
    for (const m of club.members || []) m.cycleWins = 0;
    club.chat = pruneChat([...(club.chat || []), sys("Начался новый 5-дневный цикл. Цель — 30 побед каждому!")]);
  }
}

// ── Operations ───────────────────────────────────────────────────────────────
async function opCreate(env, b) {
  const username = clean(b.username, 40);
  if (!username) return json({ success: false, error: "Не авторизован" }, 200);
  const existing = await getMembership(env, username);
  if (existing?.club_id) return json({ success: false, error: "Сначала покиньте текущий клуб" }, 200);
  const name = clean(b.name, NAME_MAX);
  if (!name) return json({ success: false, error: "Название обязательно" }, 200);
  // Honor a client-provided id so the game's local cache and the cloud stay in
  // sync, but never overwrite an existing club.
  let id = typeof b.id === "string" && /^[\w-]{1,64}$/.test(b.id) ? b.id : uid("club");
  if (await loadClub(env, id)) id = uid("club");
  const t = now();
  const club = {
    id, name, description: clean(b.description, DESC_MAX), type: b.type === "closed" ? "closed" : "open",
    avatarPreset: b.avatarPreset || "fire", avatarProfileIconId: b.avatarProfileIconId, avatarDataUrl: b.avatarDataUrl,
    createdAt: t, createdBy: username,
    members: [{ username, rank: "owner", joinedAt: t, cycleWins: 0, trophies: b.trophies || 0, playerId: b.playerId || null }],
    pendingRequests: [], cycleStartedAt: t, cycleId: 1, totalBattles: 0, rewardsClaimed: 0,
    chat: [sys("Клуб создан. За 5 дней каждому нужно 30 побед!")], bossRaid: defaultBossRaid(),
    updatedAt: t,
  };
  await saveClub(env, club);
  await setMembership(env, username, b.playerId, id);
  return json({ success: true, club }, 200);
}

async function opJoin(env, b) {
  const username = clean(b.username, 40);
  if (!username) return json({ success: false, error: "Не авторизован" }, 200);
  if ((await getMembership(env, username))?.club_id) return json({ success: false, error: "Сначала покиньте текущий клуб" }, 200);
  const club = await loadClub(env, b.clubId);
  if (!club) return json({ success: false, error: "Клуб не найден" }, 200);
  if (club.members.length >= MEMBERS_MAX) return json({ success: false, error: "Клуб заполнен" }, 200);
  if (member(club, username)) return json({ success: false, error: "Уже в клубе" }, 200);

  if (club.type === "open") {
    club.members.push({ username, rank: "junior", joinedAt: now(), cycleWins: 0, trophies: b.trophies || 0, playerId: b.playerId || null });
    club.chat.push(sys(`${username} вступил(а) в клуб`));
    await saveClub(env, club);
    await setMembership(env, username, b.playerId, club.id);
    return json({ success: true }, 200);
  }
  if (club.pendingRequests.some((r) => r.username === username)) return json({ success: false, pending: true, error: "Заявка уже отправлена" }, 200);
  club.pendingRequests.push({ username, requestedAt: now(), playerId: b.playerId || null });
  await saveClub(env, club);
  return json({ success: true, pending: true }, 200);
}

async function opLeave(env, b) {
  const username = clean(b.username, 40);
  const m = await getMembership(env, username);
  if (!m?.club_id) return json({ success: false, error: "Вы не в клубе" }, 200);
  const club = await loadClub(env, m.club_id);
  if (!club) { await setMembership(env, username, b.playerId, null); return json({ success: true }, 200); }
  const wasOwner = username === club.createdBy;
  club.members = club.members.filter((x) => x.username !== username);
  if (wasOwner && club.members.length > 0) {
    const next = [...club.members].sort((a, c) => rankIndex(c.rank) - rankIndex(a.rank))[0];
    club.createdBy = next.username; next.rank = "owner";
    club.chat.push(sys(`${next.username} стал(а) новым хозяином клуба`));
  }
  club.chat.push(sys(`${username} покинул(а) клуб`));
  if (club.members.length === 0) await deleteClub(env, club.id);
  else await saveClub(env, club);
  await setMembership(env, username, b.playerId, null);
  return json({ success: true }, 200);
}

async function opKick(env, b) {
  const { club, actor, err } = await authorize(env, b, (mm) => meta(mm.rank).canKick);
  if (err) return err;
  const target = clean(b.target, 40);
  if (target === club.createdBy) return json({ success: false, error: "Нельзя выгнать создателя" }, 200);
  const tm = member(club, target);
  if (!tm) return json({ success: false, error: "Не участник" }, 200);
  // can only kick someone strictly lower in rank (owner can kick anyone)
  if (actor.rank !== "owner" && rankIndex(tm.rank) >= rankIndex(actor.rank)) return json({ success: false, error: "Недостаточно прав" }, 200);
  club.members = club.members.filter((x) => x.username !== target);
  club.chat.push(sys(`${target} был(а) исключён(а)`));
  await saveClub(env, club);
  await setMembership(env, target, null, null);
  return json({ success: true }, 200);
}

async function opSetRank(env, b) {
  const { club, actor, err } = await authorize(env, b, (mm) => meta(mm.rank).canPromote);
  if (err) return err;
  const target = clean(b.target, 40);
  const rank = b.rank;
  if (!RANK_ORDER.includes(rank) || rank === "owner") return json({ success: false, error: "Недопустимое звание" }, 200);
  if (target === club.createdBy) return json({ success: false, error: "Нельзя сменить звание хозяина" }, 200);
  const tm = member(club, target);
  if (!tm) return json({ success: false, error: "Не участник" }, 200);
  if (actor.rank !== "owner" && rankIndex(rank) >= rankIndex(actor.rank)) return json({ success: false, error: "Нельзя назначить звание выше своего" }, 200);
  tm.rank = rank;
  club.chat.push(sys(`${target} получил(а) новое звание`));
  await saveClub(env, club);
  return json({ success: true }, 200);
}

async function opApprove(env, b) {
  const { club, err } = await authorize(env, b, (mm) => meta(mm.rank).canApproveJoin);
  if (err) return err;
  const target = clean(b.target, 40);
  if (!club.pendingRequests.some((r) => r.username === target)) return json({ success: false, error: "Заявки нет" }, 200);
  if (club.members.length >= MEMBERS_MAX) return json({ success: false, error: "Клуб заполнен" }, 200);
  const req = club.pendingRequests.find((r) => r.username === target);
  club.pendingRequests = club.pendingRequests.filter((r) => r.username !== target);
  club.members.push({ username: target, rank: "junior", joinedAt: now(), cycleWins: 0, trophies: 0, playerId: req?.playerId || null });
  club.chat.push(sys(`${target} вступил(а) в клуб`));
  await saveClub(env, club);
  await setMembership(env, target, req?.playerId, club.id);
  return json({ success: true }, 200);
}

async function opDeny(env, b) {
  const { club, err } = await authorize(env, b, (mm) => meta(mm.rank).canApproveJoin);
  if (err) return err;
  const target = clean(b.target, 40);
  club.pendingRequests = club.pendingRequests.filter((r) => r.username !== target);
  await saveClub(env, club);
  return json({ success: true }, 200);
}

async function opUpdateInfo(env, b) {
  const { club, err } = await authorize(env, b, (mm) => meta(mm.rank).canEditClub);
  if (err) return err;
  const p = b.patch || {};
  if (p.name !== undefined) club.name = clean(p.name, NAME_MAX) || club.name;
  if (p.description !== undefined) club.description = clean(p.description, DESC_MAX);
  if (p.type !== undefined) club.type = p.type === "closed" ? "closed" : "open";
  if (p.avatarPreset !== undefined) club.avatarPreset = p.avatarPreset;
  if (p.avatarProfileIconId !== undefined) { club.avatarProfileIconId = p.avatarProfileIconId || undefined; if (p.avatarProfileIconId) club.avatarDataUrl = undefined; }
  if (p.avatarDataUrl !== undefined) { club.avatarDataUrl = p.avatarDataUrl || undefined; if (p.avatarDataUrl) club.avatarProfileIconId = undefined; }
  await saveClub(env, club);
  return json({ success: true, club }, 200);
}

async function opChat(env, b) {
  const username = clean(b.username, 40);
  const club = await loadClub(env, b.clubId);
  if (!club) return json({ success: false, error: "Клуб не найден" }, 200);
  if (!member(club, username)) return json({ success: false, error: "Только участники клуба могут писать" }, 200);
  const msg = { id: uid("m"), sentAt: now(), username };
  if (b.pinId) msg.pinId = String(b.pinId);
  else if (b.battleShare) { msg.text = ""; msg.battleShare = b.battleShare; }
  else {
    const text = clean(b.text, CHAT_MAX);
    if (!text) return json({ success: false, error: "Пустое сообщение" }, 200);
    msg.text = text;
  }
  club.chat.push(msg);
  await saveClub(env, club);
  return json({ success: true, message: msg }, 200);
}

async function opRecordWin(env, b) {
  const username = clean(b.username, 40);
  const m = await getMembership(env, username);
  if (!m?.club_id) return json({ success: true }, 200);
  const club = await loadClub(env, m.club_id);
  if (!club) return json({ success: true }, 200);
  ensureCycle(club);
  const mm = member(club, username);
  if (mm && mm.cycleWins < 30) {
    mm.cycleWins += 1;
    if (mm.cycleWins === 30) club.chat.push(sys(`${username} выполнил(а) цель цикла — 30 побед!`));
  }
  club.totalBattles = (club.totalBattles || 0) + 1;
  if (typeof b.trophies === "number" && mm) mm.trophies = b.trophies;
  await saveClub(env, club);
  return json({ success: true }, 200);
}

async function opBossRaid(env, b) {
  const username = clean(b.username, 40);
  const club = await loadClub(env, b.clubId);
  if (!club) return json({ success: false, error: "Клуб не найден" }, 200);
  if (!member(club, username)) return json({ success: false, error: "Вы не в этом клубе" }, 200);
  club.bossRaid = club.bossRaid || defaultBossRaid();
  if (b.clear) club.bossRaid = { ...defaultBossRaid(), bossId: club.bossRaid.bossId, updatedAt: now() };
  else {
    if (b.bossId !== undefined) club.bossRaid.bossId = b.bossId;
    if (b.partyCode !== undefined) club.bossRaid.partyCode = b.partyCode;
    if (b.joinedPlayerIds !== undefined) club.bossRaid.joinedPlayerIds = b.joinedPlayerIds;
    if (b.leaderUsername !== undefined) club.bossRaid.leaderUsername = b.leaderUsername;
    if (b.leaderPlayerId !== undefined) club.bossRaid.leaderPlayerId = b.leaderPlayerId;
    club.bossRaid.updatedAt = now();
  }
  await saveClub(env, club);
  return json({ success: true, club }, 200);
}

// Shared authorization: actor must be a member of the club with a permission.
async function authorize(env, b, check) {
  const username = clean(b.username, 40);
  const club = await loadClub(env, b.clubId);
  if (!club) return { err: json({ success: false, error: "Клуб не найден" }, 200) };
  const actor = member(club, username);
  if (!actor) return { err: json({ success: false, error: "Вы не в этом клубе" }, 200) };
  if (!check(actor)) return { err: json({ success: false, error: "Нет прав" }, 200) };
  return { club, actor };
}

// ── Router ───────────────────────────────────────────────────────────────────
const WRITE_OPS = {
  create: opCreate, join: opJoin, leave: opLeave, kick: opKick, setRank: opSetRank,
  approve: opApprove, deny: opDeny, updateInfo: opUpdateInfo, chat: opChat,
  recordWin: opRecordWin, bossRaid: opBossRaid,
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return json({}, 204);

    try {
      // ── Reads ───────────────────────────────────────────────────────────────
      if (url.pathname === "/healthz") {
        const c = await env.DB.prepare("SELECT COUNT(*) n FROM clubs").first();
        return json({ ok: true, clubs: c?.n ?? 0 });
      }
      if (url.pathname === "/clubs/get" && req.method === "GET") {
        const club = await loadClub(env, url.searchParams.get("id"));
        return json({ club });
      }
      if (url.pathname === "/clubs/list" && req.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
        const rows = await env.DB.prepare("SELECT data FROM clubs ORDER BY total_trophies DESC, member_count DESC LIMIT ?").bind(limit).all();
        return json({ clubs: (rows.results || []).map((r) => JSON.parse(r.data)) });
      }
      if (url.pathname === "/clubs/search" && req.method === "GET") {
        const q = `%${(url.searchParams.get("q") || "").toLowerCase()}%`;
        const rows = await env.DB.prepare("SELECT data FROM clubs WHERE name_lower LIKE ? ORDER BY total_trophies DESC LIMIT 50").bind(q).all();
        return json({ clubs: (rows.results || []).map((r) => JSON.parse(r.data)) });
      }
      if (url.pathname === "/clubs/mine" && req.method === "GET") {
        const m = await getMembership(env, clean(url.searchParams.get("username"), 40));
        const club = m?.club_id ? await loadClub(env, m.club_id) : null;
        return json({ club });
      }

      // ── Writes (permission-checked + rate-limited) ────────────────────────────
      if (url.pathname.startsWith("/clubs/") && req.method === "POST") {
        const op = url.pathname.slice("/clubs/".length);
        const handler = WRITE_OPS[op];
        if (!handler) return json({ error: "unknown_op" }, 404);
        const ip = req.headers.get("cf-connecting-ip") || "anon";
        if (!(await rateLimit(env, `${ip}:${op}`, 40, 60_000))) return json({ success: false, error: "Слишком часто, подождите" }, 429);
        const body = await req.json().catch(() => ({}));
        return await handler(env, body);
      }

      return json({ error: "not_found" }, 404);
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500);
    }
  },
};
