// ─────────────────────────────────────────────────────────────────────────────
// OnlineBattle.tsx — thin renderer for a server-authoritative match.
// The server computes everything; this component only draws the latest snapshot
// (interpolated for smoothness) and sends local input at 20Hz. Works for the
// player's own brawler; the other 5 slots are real players or server bots.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import {
  connectBattleV2 as connectOnlineBattle,
  connectOnlineSpectate,
  fetchOnlineStats,
  lookupOnlineSpectate,
} from "../../net/v2/BattleConnection";
import type { BattleConnectionV2 as BattleConnection } from "../../net/v2/BattleConnection";
import type {
  BattleInput,
  NetEffect,
  NetMap,
  NetResult,
  NetSnapshot,
  OnlineStats,
} from "../../net/battleTypes";
import { applyOnlineBattleRewards, getCurrentProfile, getCurrentUsername } from "../../utils/localStorageAPI";
import { getBrawlerById } from "../../entities/BrawlerData";
import { getCharRenderer } from "../../game/miyaTopDownRenderer";
import { BRAWLER_DRAW_SCALE } from "../../game/battleVisualScale";

// Must match battle-server/src/sim/constants.mjs
const ARENA = { w: 1600, h: 1600, margin: 80 };
const BRAWLER_RADIUS = 34;
const VIEW_W = 920; // world units visible across width
const SNAPSHOT_MS = 1000 / 20;

type Phase = "connecting" | "forming" | "playing" | "ended" | "error";

const MODE_META: Record<string, { label: string; icon: string; duration: number }> = {
  gemGrab: { label: "Захват кристаллов", icon: "◆", duration: 150 },
  bounty: { label: "Награда", icon: "⭐", duration: 120 },
  knockout: { label: "Нокаут", icon: "🏅", duration: 0 },
  heist: { label: "Налёт", icon: "%", duration: 150 },
  showdown: { label: "Шоудаун", icon: "☠", duration: 150 },
  training: { label: "Тренировка", icon: "🎯", duration: 0 },
  crystals: { label: "Кристальная битва", icon: "◆", duration: 150 },
  starstrike: { label: "Звёздный удар", icon: "⚽", duration: 150 },
  monsterInvasion: { label: "Нашествие монстров", icon: "👾", duration: 240 },
  siege: { label: "Осада", icon: "🏰", duration: 240 },
  monsterhide: { label: "Охота на монстров", icon: "🐾", duration: 180 },
  bossraid: { label: "Рейд на босса", icon: "💀", duration: 180 },
  teamHunt: { label: "Звёздная охота", icon: "⭐", duration: 150 },
  megashowdown: { label: "Мегашоудаун", icon: "☠", duration: 180 },
};

const PVE_MODES = new Set(["monsterInvasion", "siege", "monsterhide", "bossraid", "teamHunt"]);
const FFA_MODES = new Set(["showdown", "megashowdown", "teamHunt"]);

export default function OnlineBattle({
  onExit,
  mode = "gemGrab",
  spectatePlayerId,
  spectateName,
  brawlerIdOverride,
}: {
  onExit: () => void;
  mode?: string;
  spectatePlayerId?: string;
  spectateName?: string;
  /** Force a specific brawler (used by Training to test any brawler). */
  brawlerIdOverride?: string;
}) {
  const spectating = !!spectatePlayerId;
  const modeMeta = MODE_META[mode] || MODE_META.gemGrab;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const connRef = useRef<BattleConnection | null>(null);
  const prevSnap = useRef<NetSnapshot | null>(null);
  const currSnap = useRef<NetSnapshot | null>(null);
  const currAt = useRef<number>(0);
  const youId = useRef<string | null>(null);
  const mapRef = useRef<NetMap | null>(null);
  const teamRef = useRef<0 | 1>(0);
  const fxRef = useRef<Array<NetEffect & { born: number }>>([]);
  const requestedModels = useRef<Set<string>>(new Set());

  const input = useRef<BattleInput>({ mx: 0, my: 0, ax: 1, ay: 0, attack: false, super: false });
  const keys = useRef<Record<string, boolean>>({});
  const moveStick = useRef<{ id: number; cx: number; cy: number; dx: number; dy: number } | null>(null);
  const aimStick = useRef<{ id: number; cx: number; cy: number; dx: number; dy: number } | null>(null);
  const mouse = useRef<{ x: number; y: number; down: boolean }>({ x: 0, y: 0, down: false });

  const [phase, setPhase] = useState<Phase>("connecting");
  const [status, setStatus] = useState("Подключение…");
  const [result, setResult] = useState<NetResult | null>(null);
  const [myReward, setMyReward] = useState<{ trophyDelta: number; coins: number; xp: number } | null>(null);
  const [onlineStats, setOnlineStats] = useState<OnlineStats | null>(null);
  const rewardApplied = useRef(false);
  const [ping, setPing] = useState(0);

  // ── Connect ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const profile = getCurrentProfile();
    const brawlerId = brawlerIdOverride || profile?.selectedBrawlerId || "miya";
    const level = profile?.brawlerLevels?.[brawlerId] || 1;
    const name = getCurrentUsername() || "Player";
    const playerId = profile?.playerId || undefined;

    // ── Spectator mode: watch someone else's live server battle (read-only) ──
    if (spectating && spectatePlayerId) {
      youId.current = spectatePlayerId; // camera follows + highlights the watched player
      setStatus("Подключение к бою игрока…");
      connectOnlineSpectate({
        playerId: spectatePlayerId,
        onStart: (info) => { if (alive) { mapRef.current = info.map; setPhase("playing"); setStatus(""); } },
        onState: (s) => {
          prevSnap.current = currSnap.current;
          currSnap.current = s;
          currAt.current = performance.now();
          const meU = s.units.find((u) => u.id === spectatePlayerId);
          if (meU) teamRef.current = meU.t;
          for (const u of s.units) {
            if (u.mon) continue;
            if (!requestedModels.current.has(u.b)) { requestedModels.current.add(u.b); getCharRenderer(u.b); }
          }
          if (s.fx && s.fx.length) {
            const now = performance.now();
            for (const e of s.fx) fxRef.current.push({ ...e, born: now });
            if (fxRef.current.length > 120) fxRef.current.splice(0, fxRef.current.length - 120);
          }
          if (alive && phaseRef.current !== "playing" && !s.over) setPhase("playing");
        },
        onResult: (res) => { if (alive) { setResult(res); setPhase("ended"); } },
        onError: (err) => { if (alive) { setStatus(err); setPhase("error"); } },
        onClose: () => { if (alive && phaseRef.current !== "ended") setStatus("Бой завершён"); },
      })
        .then((conn) => {
          if (!alive) { conn.disconnect(); return; }
          connRef.current = conn;
        })
        .catch((e) => { if (alive) { setStatus(String(e?.message || e)); setPhase("error"); } });

      return () => { alive = false; connRef.current?.disconnect(); connRef.current = null; };
    }

    connectOnlineBattle({
      mode,
      playerId,
      brawlerId,
      level,
      name,
      onJoined: (info) => alive && setStatus(info.phase === "running" ? "Бой идёт…" : "Ждём игроков…"),
      onStart: (info) => { if (alive) { mapRef.current = info.map; setPhase("playing"); setStatus(""); } },
      onYou: (uid, t) => { youId.current = uid; teamRef.current = t === "red" ? 1 : 0; },
      onState: (s) => {
        prevSnap.current = currSnap.current;
        currSnap.current = s;
        currAt.current = performance.now();
        // Lazily warm up the real 3D model for whoever is in this match.
        for (const u of s.units) {
          if (u.mon) continue;
          if (!requestedModels.current.has(u.b)) {
            requestedModels.current.add(u.b);
            getCharRenderer(u.b); // triggers GLB load on first request
          }
        }
        if (s.fx && s.fx.length) {
          const now = performance.now();
          for (const e of s.fx) fxRef.current.push({ ...e, born: now });
          if (fxRef.current.length > 120) fxRef.current.splice(0, fxRef.current.length - 120);
        }
        if (alive && phaseRef.current !== "playing" && !s.over) setPhase("playing");
      },
      onResult: (res) => {
        if (!alive) return;
        setResult(res);
        const mine = youId.current ? res.rewards[youId.current] : undefined;
        if (mine && !rewardApplied.current) {
          rewardApplied.current = true;
          applyOnlineBattleRewards(mine);
          setMyReward({ trophyDelta: mine.trophyDelta, coins: mine.coins, xp: mine.xp });
        }
        setPhase("ended");
        // Pull the server-authoritative online totals (anti-cheat source of truth).
        if (playerId) {
          setTimeout(() => { fetchOnlineStats(playerId).then((s) => { if (alive && s) setOnlineStats(s); }); }, 700);
        }
      },
      onError: (err) => { if (alive) { setStatus(err); setPhase("error"); } },
      onClose: () => { if (alive && phaseRef.current !== "ended") setStatus("Соединение закрыто"); },
    })
      .then((conn) => {
        if (!alive) { conn.disconnect(); return; }
        connRef.current = conn;
        setPhase("forming");
        setStatus("Ждём игроков…");
      })
      .catch((e) => { if (alive) { setStatus(String(e?.message || e)); setPhase("error"); } });

    return () => {
      alive = false;
      connRef.current?.disconnect();
      connRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep latest phase in a ref for use inside callbacks
  const phaseRef = useRef<Phase>("connecting");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Input send loop (20Hz) + ping ────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const conn = connRef.current;
      if (!conn || spectating) return;
      computeInput();
      conn.sendInput(input.current);
    }, SNAPSHOT_MS);
    const pingId = setInterval(() => {
      connRef.current?.ping();
      setPing(connRef.current?.latencyMs() || 0);
    }, 1500);
    return () => { clearInterval(id); clearInterval(pingId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === " ") input.current.super = true;
      if (e.key === "Escape") onExit();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      if (e.key === " ") input.current.super = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function computeInput() {
    // Movement: joystick (touch) overrides keyboard.
    if (moveStick.current) {
      const { dx, dy } = moveStick.current;
      const m = Math.hypot(dx, dy) || 1;
      input.current.mx = Math.max(-1, Math.min(1, dx / 60));
      input.current.my = Math.max(-1, Math.min(1, dy / 60));
      if (m < 6) { input.current.mx = 0; input.current.my = 0; }
    } else {
      let mx = 0, my = 0;
      if (keys.current["w"] || keys.current["arrowup"]) my -= 1;
      if (keys.current["s"] || keys.current["arrowdown"]) my += 1;
      if (keys.current["a"] || keys.current["arrowleft"]) mx -= 1;
      if (keys.current["d"] || keys.current["arrowright"]) mx += 1;
      input.current.mx = mx; input.current.my = my;
    }

    // Aim + attack
    if (aimStick.current) {
      const { dx, dy } = aimStick.current;
      if (Math.hypot(dx, dy) > 8) { input.current.ax = dx; input.current.ay = dy; input.current.attack = true; }
      else input.current.attack = false;
    } else {
      const canvas = canvasRef.current;
      const me = currUnit(youId.current);
      if (canvas && me) {
        const scale = canvas.width / VIEW_W;
        const cam = cameraFor(me);
        const sx = (me.x - cam.x) * scale;
        const sy = (me.y - cam.y) * scale;
        input.current.ax = mouse.current.x - sx;
        input.current.ay = mouse.current.y - sy;
      }
      input.current.attack = mouse.current.down || keys.current["k"] === true;
      input.current.super = keys.current[" "] === true || keys.current["shift"] === true;
    }
  }

  function currUnit(id: string | null) {
    if (!id || !currSnap.current) return null;
    return currSnap.current.units.find((u) => u.id === id) || null;
  }
  function cameraFor(me: { x: number; y: number }) {
    const canvas = canvasRef.current!;
    const scale = canvas.width / VIEW_W;
    const viewH = canvas.height / scale;
    let x = me.x - VIEW_W / 2;
    let y = me.y - viewH / 2;
    x = Math.max(0, Math.min(ARENA.w - VIEW_W, x));
    y = Math.max(0, Math.min(ARENA.h - viewH, y));
    return { x, y };
  }

  // ── Render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      draw(ctx, canvas);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const curr = currSnap.current;
    ctx.fillStyle = "#0d1422";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!curr) return;

    const alpha = Math.max(0, Math.min(1, (performance.now() - currAt.current) / SNAPSHOT_MS));
    const prev = prevSnap.current;
    const lerpUnit = (u: NetSnapshot["units"][number]) => {
      if (!prev) return { x: u.x, y: u.y, a: u.a };
      const p = prev.units.find((q) => q.id === u.id);
      if (!p) return { x: u.x, y: u.y, a: u.a };
      return { x: p.x + (u.x - p.x) * alpha, y: p.y + (u.y - p.y) * alpha, a: u.a };
    };

    const me = currUnit(youId.current) || curr.units[0];
    const scale = canvas.width / VIEW_W;
    const cam = me ? cameraFor(me) : { x: 0, y: 0 };
    const wx = (x: number) => (x - cam.x) * scale;
    const wy = (y: number) => (y - cam.y) * scale;

    // Arena floor
    ctx.fillStyle = "#16233a";
    ctx.fillRect(wx(ARENA.margin), wy(ARENA.margin), (ARENA.w - 2 * ARENA.margin) * scale, (ARENA.h - 2 * ARENA.margin) * scale);

    // Tile map (walls + bushes)
    const map = mapRef.current;
    if (map) {
      const cs = map.cell * scale;
      for (let r = 0; r < map.n; r++) {
        for (let c = 0; c < map.n; c++) {
          const t = map.grid[r][c];
          if (t === 0) continue;
          const x = wx(c * map.cell);
          const y = wy(r * map.cell);
          if (x + cs < 0 || y + cs < 0 || x > canvas.width || y > canvas.height) continue;
          if (t === 1) {
            // wall — raised block with a lit top edge
            ctx.fillStyle = "#33476e";
            ctx.fillRect(x, y, cs, cs);
            ctx.fillStyle = "#46608f";
            ctx.fillRect(x, y, cs, cs * 0.22);
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(x, y + cs * 0.82, cs, cs * 0.18);
          } else if (t === 2) {
            // bush — leafy cell
            ctx.fillStyle = "#1f6e3a";
            ctx.fillRect(x, y, cs, cs);
            ctx.fillStyle = "rgba(120,220,150,0.25)";
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.arc(x + cs * (0.25 + 0.5 * (i % 2)), y + cs * (0.25 + 0.5 * (i > 1 ? 1 : 0)), cs * 0.22, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    // Showdown poison gas: red haze everywhere except the safe circle.
    if (curr.gas) {
      const sr = curr.gas.r * scale;
      const gx = wx(curr.gas.cx), gy = wy(curr.gas.cy);
      ctx.save();
      ctx.fillStyle = "rgba(180,20,90,0.32)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(0, sr), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // safe-zone boundary ring
      ctx.save();
      ctx.strokeStyle = "rgba(255,90,150,0.85)";
      ctx.lineWidth = 3 * scale;
      ctx.setLineDash([10 * scale, 8 * scale]);
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(0, sr), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Showdown power cubes
    for (const c of curr.cubes ?? []) {
      const cx2 = wx(c.x), cy2 = wy(c.y);
      const sz = 13 * scale;
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#b06bff";
      ctx.shadowColor = "#b06bff";
      ctx.shadowBlur = 10 * scale;
      ctx.fillRect(-sz, -sz, 2 * sz, 2 * sz);
      ctx.fillStyle = "#e6c6ff";
      ctx.fillRect(-sz * 0.4, -sz * 0.4, sz * 0.8, sz * 0.8);
      ctx.restore();
    }

    // Gems
    for (const g of curr.gems) {
      ctx.save();
      ctx.translate(wx(g.x), wy(g.y));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#23e0c8";
      ctx.shadowColor = "#23e0c8";
      ctx.shadowBlur = 10 * scale;
      const s = 11 * scale;
      ctx.fillRect(-s, -s, 2 * s, 2 * s);
      ctx.restore();
    }

    // Safes (Heist objective)
    if (curr.safes) {
      for (const s of curr.safes) {
        const sx = wx(s.x), sy = wy(s.y);
        const half = 48 * scale;
        const col = s.t === 0 ? "#3da5ff" : "#ff5252";
        const dead = s.hp <= 0;
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = dead ? 0 : 16 * scale;
        ctx.fillStyle = dead ? "#3a3f4a" : "#cfd6e2";
        ctx.fillRect(sx - half, sy - half, half * 2, half * 2);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4 * scale;
        ctx.strokeStyle = col;
        ctx.strokeRect(sx - half, sy - half, half * 2, half * 2);
        // keyhole
        ctx.fillStyle = dead ? "#555" : "#2a3550";
        ctx.beginPath();
        ctx.arc(sx, sy, half * 0.32, 0, Math.PI * 2);
        ctx.fill();
        // HP bar
        const bw = half * 2, bh = 8 * scale;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(sx - half, sy - half - bh - 4 * scale, bw, bh);
        ctx.fillStyle = col;
        ctx.fillRect(sx - half, sy - half - bh - 4 * scale, bw * Math.max(0, s.hp / s.mhp), bh);
        ctx.restore();
      }
    }

    // Crystals deposit bases (zone you must carry gems into to bank them)
    for (const b of curr.bases ?? []) {
      const bx = wx(b.x), by = wy(b.y), br = b.r * scale;
      const col = b.t === 0 ? "#3da5ff" : "#ff5252";
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 * scale;
      ctx.setLineDash([12 * scale, 8 * scale]);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
    }

    // Star Strike goals + ball
    if (curr.goals) {
      for (const g of curr.goals) {
        const gx = wx(g.x), gy = wy(g.y), hw = g.hw * scale;
        const col = g.t === 0 ? "#3da5ff" : "#ff5252";
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 6 * scale;
        ctx.shadowColor = col;
        ctx.shadowBlur = 14 * scale;
        ctx.beginPath();
        ctx.moveTo(gx - hw, gy);
        ctx.lineTo(gx + hw, gy);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (curr.ball) {
      const bx = wx(curr.ball.x), by = wy(curr.ball.y), br = 16 * scale;
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = "#ffe08a";
      ctx.shadowColor = "#ffd54f";
      ctx.shadowBlur = 16 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b07a16";
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
      // star mark
      ctx.fillStyle = "#b07a16";
      ctx.font = `${Math.round(18 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", 0, 1 * scale);
      ctx.restore();
    }

    // Siege base (defend this structure)
    if (curr.base) {
      const bx = wx(curr.base.x), by = wy(curr.base.y), br = curr.base.r * scale;
      const frac = Math.max(0, curr.base.hp / curr.base.mhp);
      ctx.save();
      ctx.fillStyle = "#2a3550";
      ctx.strokeStyle = "#7CFF6B";
      ctx.lineWidth = 5 * scale;
      ctx.shadowColor = "#7CFF6B";
      ctx.shadowBlur = 16 * scale;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#cfe8ff";
      ctx.font = `${Math.round(br * 0.7)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🏰", bx, by + 2 * scale);
      const bw = br * 2, bh = 8 * scale, byy = by - br - bh - 6 * scale;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - br, byy, bw, bh);
      ctx.fillStyle = frac > 0.3 ? "#7CFF6B" : "#ff5252"; ctx.fillRect(bx - br, byy, bw * frac, bh);
      ctx.restore();
    }

    // Projectiles
    for (const p of curr.projectiles) {
      ctx.beginPath();
      ctx.fillStyle = p.t === 0 ? "#5db4ff" : "#ff6b6b";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8 * scale;
      ctx.arc(wx(p.x), wy(p.y), (p.k === 2 ? 9 : 6) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Units
    const myTeam = teamRef.current;
    for (const u of curr.units) {
      const li = lerpUnit(u);
      const x = wx(li.x);
      const y = wy(li.y);
      const r = BRAWLER_RADIUS * scale;

      // PvE monsters: simple creature sprite (no brawler model), HP bar.
      if (u.mon) {
        if (!u.al) continue;
        const mcol = u.mt === "boss" ? "#ff5252" : u.mt === "brute" ? "#b08152" : u.mt === "shooter" ? "#d06ad0" : "#7cc36a";
        const mr = (u.mt === "boss" ? 2.6 : u.mt === "brute" ? 1.45 : 1) * r;
        ctx.beginPath(); ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.ellipse(x, y + mr * 0.7, mr * 0.9, mr * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.fillStyle = mcol; ctx.arc(x, y, mr, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3 * scale; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(x - mr * 0.32, y - mr * 0.12, mr * 0.2, 0, Math.PI * 2); ctx.arc(x + mr * 0.32, y - mr * 0.12, mr * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(x - mr * 0.32, y - mr * 0.12, mr * 0.09, 0, Math.PI * 2); ctx.arc(x + mr * 0.32, y - mr * 0.12, mr * 0.09, 0, Math.PI * 2); ctx.fill();
        const bw = mr * 1.8, barY = y - mr * 1.35, hpFrac = Math.max(0, u.hp / u.mhp);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - bw / 2, barY, bw, 5 * scale);
        ctx.fillStyle = "#ff7a7a"; ctx.fillRect(x - bw / 2, barY, bw * hpFrac, 5 * scale);
        continue;
      }

      // Enemies hidden in a bush show only a rustle unless near my brawler.
      const isSelf = u.id === youId.current;
      const isFFA = FFA_MODES.has(mode);
      const isEnemy = isFFA ? !isSelf : u.t !== myTeam;
      if (isEnemy && u.bu && u.al && me) {
        const d = Math.hypot(li.x - me.x, li.y - me.y);
        if (d > 150) {
          ctx.fillStyle = "rgba(150,230,170,0.5)";
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(x + (i - 1) * 8 * scale, y - 2 * scale, 5 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }
      }
      const teamColor = isFFA
        ? (isSelf ? "#7CFF6B" : "#ff5252")
        : (u.t === 0 ? "#3da5ff" : "#ff5252");
      const meta = getBrawlerById(u.b);
      const body = meta?.color || (u.t === 0 ? "#2a6fb0" : "#b03a2a");
      const alpha = u.al ? 1 : 0.4;

      ctx.globalAlpha = alpha;
      // ground shadow
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.ellipse(x, y + r * 0.72, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // team ring on the ground (so it reads under the sprite)
      ctx.beginPath();
      ctx.lineWidth = 4 * scale;
      ctx.strokeStyle = u.id === youId.current ? "#7CFF6B" : teamColor;
      ctx.ellipse(x, y + r * 0.72, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // aim indicator (drawn under the sprite)
      if (u.al) {
        ctx.beginPath();
        ctx.strokeStyle = isEnemy ? "rgba(255,120,120,0.45)" : "rgba(124,255,107,0.5)";
        ctx.lineWidth = 3 * scale;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(li.a) * r * 1.6, y + Math.sin(li.a) * r * 1.6);
        ctx.stroke();
      }

      // Real 3D brawler model (GLB rendered to an offscreen canvas); falls back
      // to a colored disc until the model has downloaded.
      const drawSize = r * BRAWLER_DRAW_SCALE;
      const glow = u.id === youId.current ? "#7CFF6B" : (u.sh > 0 && u.al ? "rgba(120,200,255,0.95)" : undefined);
      const cr = getCharRenderer(u.b);
      let drew = false;
      if (cr) {
        const prevU = prev?.units.find((q) => q.id === u.id);
        const moved = prevU ? Math.hypot(u.x - prevU.x, u.y - prevU.y) : 0;
        const anim: "dead" | "run" | "still" = !u.al ? "dead" : moved > 1.2 ? "run" : "still";
        const off = cr.render(u.id, anim, li.a);
        if (off) {
          ctx.save();
          ctx.globalAlpha = alpha;
          if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 22 * scale; }
          ctx.drawImage(off, x - drawSize / 2, y - drawSize * 0.6, drawSize, drawSize);
          ctx.restore();
          drew = true;
        }
      }
      if (!drew) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = body;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = teamColor;
        ctx.stroke();
      }

      // shield ring around the brawler
      if (u.sh > 0 && u.al) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(120,200,255,0.9)";
        ctx.lineWidth = 4 * scale;
        ctx.arc(x, y, r + 6 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // HP bar (raised above the taller sprite)
      const bw = r * 1.8;
      const barY = y - r * 1.7;
      const hpFrac = Math.max(0, u.hp / u.mhp);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - bw / 2, barY, bw, 6 * scale);
      ctx.fillStyle = u.id === youId.current ? "#7CFF6B" : teamColor;
      ctx.fillRect(x - bw / 2, barY, bw * hpFrac, 6 * scale);

      // carried gems / bounty stars / power cubes indicator
      const tag = u.g > 0 ? `◆${u.g}` : (u.st && u.st > 0 ? `⭐${u.st}` : (u.pc && u.pc > 0 ? `⬢${u.pc}` : ""));
      if (tag) {
        ctx.fillStyle = u.g > 0 ? "#23e0c8" : (u.st && u.st > 0 ? "#ffd54a" : "#c79bff");
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(tag, x, barY - 4 * scale);
      }
      // respawn timer
      if (!u.al) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${16 * scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${Math.ceil(u.rt)}`, x, y + 5 * scale);
      }
    }

    // Turrets
    for (const tr of curr.turrets ?? []) {
      const x = wx(tr.x), y = wy(tr.y);
      const sz = 22 * scale;
      ctx.fillStyle = tr.t === 0 ? "#2a6fb0" : "#b03a2a";
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      ctx.strokeStyle = tr.t === 0 ? "#5db4ff" : "#ff6b6b";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
      const f = Math.max(0, tr.hp / tr.mhp);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - sz / 2, y - sz / 2 - 7 * scale, sz, 4 * scale);
      ctx.fillStyle = "#7CFF6B";
      ctx.fillRect(x - sz / 2, y - sz / 2 - 7 * scale, sz * f, 4 * scale);
    }

    // Transient effects (supers, blasts)
    const now = performance.now();
    fxRef.current = fxRef.current.filter((e) => now - e.born < 350);
    for (const e of fxRef.current) {
      const age = (now - e.born) / 350; // 0..1
      const col = e.t === 0 ? "93,180,255" : "255,107,107";
      const x = wx(e.x), y = wy(e.y);
      ctx.lineWidth = 3 * scale;
      if (e.ty === "nova" || e.ty === "blast" || e.ty === "heal" || e.ty === "turret" || e.ty === "shield") {
        const baseR = (e.r ?? (e.ty === "blast" ? 80 : 60)) * scale;
        const rr = baseR * (0.4 + 0.6 * age);
        const color = e.ty === "heal" ? "120,255,150" : e.ty === "blast" ? "255,190,80" : col;
        ctx.strokeStyle = `rgba(${color},${1 - age})`;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.ty === "dash" || e.ty === "beam") {
        const x2 = e.ty === "dash" ? wx(e.x2 ?? e.x) : x + Math.cos(e.a ?? 0) * 600 * scale;
        const y2 = e.ty === "dash" ? wy(e.y2 ?? e.y) : y + Math.sin(e.a ?? 0) * 600 * scale;
        ctx.strokeStyle = `rgba(${col},${1 - age})`;
        ctx.lineWidth = (e.ty === "beam" ? 6 : 10) * scale * (1 - age * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (e.ty === "melee") {
        ctx.strokeStyle = `rgba(255,255,255,${1 - age})`;
        ctx.lineWidth = 6 * scale;
        ctx.beginPath();
        const rr = (e.r ?? 90) * scale;
        ctx.arc(x, y, rr, (e.a ?? 0) - 0.6, (e.a ?? 0) + 0.6);
        ctx.stroke();
      }
    }

    drawTouchSticks(ctx);
  }

  function drawTouchSticks(ctx: CanvasRenderingContext2D) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const stick of [moveStick.current, aimStick.current]) {
      if (!stick) continue;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 4 * dpr;
      ctx.arc(stick.cx * dpr, stick.cy * dpr, 55 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const m = Math.hypot(stick.dx, stick.dy);
      const k = m > 55 ? 55 / m : 1;
      ctx.arc((stick.cx + stick.dx * k) * dpr, (stick.cy + stick.dy * k) * dpr, 26 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Pointer (touch + mouse) ──────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (spectating) return;
    const x = e.clientX, y = e.clientY;
    if (e.pointerType === "touch") {
      if (x < window.innerWidth / 2 && !moveStick.current) moveStick.current = { id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0 };
      else if (!aimStick.current) aimStick.current = { id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0 };
    } else {
      mouse.current.x = x * Math.min(2, window.devicePixelRatio || 1);
      mouse.current.y = y * Math.min(2, window.devicePixelRatio || 1);
      if (e.button === 0) mouse.current.down = true;
      if (e.button === 2) input.current.super = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const x = e.clientX, y = e.clientY;
    if (e.pointerType === "touch") {
      if (moveStick.current?.id === e.pointerId) { moveStick.current.dx = x - moveStick.current.cx; moveStick.current.dy = y - moveStick.current.cy; }
      if (aimStick.current?.id === e.pointerId) { aimStick.current.dx = x - aimStick.current.cx; aimStick.current.dy = y - aimStick.current.cy; }
    } else {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      mouse.current.x = x * dpr; mouse.current.y = y * dpr;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      if (moveStick.current?.id === e.pointerId) moveStick.current = null;
      if (aimStick.current?.id === e.pointerId) aimStick.current = null;
    } else {
      if (e.button === 0) mouse.current.down = false;
      if (e.button === 2) input.current.super = false;
    }
  };

  const showOverlay = phase === "connecting" || phase === "forming" || phase === "error" || phase === "ended";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0d1422", overflow: "hidden", touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: "block", width: "100%", height: "100%" }}
      />

      {/* HUD */}
      {phase === "playing" && currSnap.current && (mode === "showdown" || mode === "megashowdown") && (
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          <div style={{ color: "#ff9ec4", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>{modeMeta.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.5)", padding: "5px 16px", borderRadius: 999, border: "2px solid #ff5a96" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>☠ {currSnap.current.alive ?? "-"}</span>
            {(() => {
              const meU = currSnap.current!.units.find((q) => q.id === youId.current);
              const livesTag = meU && meU.lv != null ? ` · ❤${meU.lv}` : "";
              return <span style={{ color: meU && meU.al ? "#7CFF6B" : "#ff6b6b", fontWeight: 800, fontSize: 14 }}>
                {meU && meU.al ? `жив · ⚔${meU.k}${livesTag}` : (meU && meU.lv && meU.lv > 0 ? `возрождение${livesTag}` : "выбыл")}
              </span>;
            })()}
          </div>
        </div>
      )}
      {phase === "playing" && mode === "training" && (
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ color: "#9fe9df", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, background: "rgba(0,0,0,0.45)", padding: "5px 16px", borderRadius: 999, border: "2px solid #23e0c8" }}>
            🎯 {modeMeta.label}
          </div>
        </div>
      )}
      {phase === "playing" && currSnap.current && !PVE_MODES.has(mode) && !FFA_MODES.has(mode) && mode !== "training" && (
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          <div style={{ color: "#9fb3d1", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{modeMeta.label}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <ScoreChip color="#3da5ff" icon={modeMeta.icon} value={currSnap.current.score.blue} cd={currSnap.current.countdown.blue} />
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, alignSelf: "center", minWidth: 64, textAlign: "center" }}>
              {mode === "knockout"
                ? `Раунд ${currSnap.current.rounds?.n ?? 1}`
                : `${Math.max(0, modeMeta.duration - Math.floor(currSnap.current.time))}s`}
            </div>
            <ScoreChip color="#ff5252" icon={modeMeta.icon} value={currSnap.current.score.red} cd={currSnap.current.countdown.red} />
          </div>
        </div>
      )}
      {phase === "playing" && currSnap.current && PVE_MODES.has(mode) && (
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          <div style={{ color: "#9fb3d1", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{modeMeta.label}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, alignItems: "center" }}>
            {mode === "bossraid" && currSnap.current.boss && (
              <div style={{ width: 220, height: 16, background: "rgba(0,0,0,0.55)", borderRadius: 999, border: "2px solid #ff5252", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(0, 100 * currSnap.current.boss.hp / currSnap.current.boss.mhp)}%`, height: "100%", background: "linear-gradient(90deg,#ff7a7a,#ff2d2d)" }} />
              </div>
            )}
            {currSnap.current.waves != null && (
              <span style={{ color: "#ffd54a", fontWeight: 800, fontSize: 14 }}>Волна {currSnap.current.wave}/{currSnap.current.waves}</span>
            )}
            {mode === "monsterhide" && (
              <span style={{ color: "#7cc36a", fontWeight: 800, fontSize: 14 }}>Осталось: {currSnap.current.monsters ?? 0}</span>
            )}
            {mode === "teamHunt" && (
              <span style={{ color: "#ffd54a", fontWeight: 800, fontSize: 14 }}>⭐ {currSnap.current.score.blue}</span>
            )}
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, minWidth: 50, textAlign: "center" }}>
              {Math.max(0, modeMeta.duration - Math.floor(currSnap.current.time))}s
            </span>
            {(mode === "monsterInvasion" || mode === "siege") && (
              <span style={{ color: "#9fe9df", fontWeight: 800, fontSize: 14 }}>☠ {currSnap.current.kills ?? 0}</span>
            )}
          </div>
        </div>
      )}

      {phase === "playing" && (
        <div style={{ position: "absolute", top: 12, right: 12, color: "#9fb3d1", fontSize: 12, fontFamily: "monospace" }}>
          {ping}ms
        </div>
      )}

      {/* Spectator badge */}
      {spectating && phase === "playing" && (
        <div style={{
          position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
          padding: "5px 14px", borderRadius: 999, background: "rgba(0,0,0,0.6)",
          border: "2px solid #ffd54a", color: "#ffe082", fontWeight: 800, fontSize: 12, letterSpacing: 1,
        }}>
          👁 Наблюдение{spectateName ? ` · ${spectateName}` : ""}
        </div>
      )}

      {/* Super button (touch) */}
      {phase === "playing" && !spectating && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); input.current.super = true; }}
          onPointerUp={(e) => { e.stopPropagation(); input.current.super = false; }}
          style={{
            position: "absolute", right: 28, bottom: 110, width: 84, height: 84, borderRadius: "50%",
            border: "3px solid #ffd54a", background: "rgba(255,179,0,0.25)", color: "#ffe082",
            fontWeight: 800, fontSize: 14,
          }}
        >
          СУПЕР
        </button>
      )}

      <button
        onClick={onExit}
        style={{ position: "absolute", top: 12, left: 12, padding: "8px 14px", borderRadius: 10, border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", fontWeight: 700 }}
      >
        ← Выход
      </button>

      {showOverlay && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(6,10,18,0.78)", gap: 16 }}>
          {phase === "ended" && result ? (
            <>
              {FFA_MODES.has(mode) ? (() => {
                const myRow = result.scoreboard.find((r) => r.id === youId.current);
                const rank = myRow?.rank ?? 0;
                const win = rank === 1;
                return (
                  <div style={{ fontSize: 40, fontWeight: 900, color: win ? "#7CFF6B" : rank && rank <= 4 ? "#ffd54a" : "#ff6b6b" }}>
                    {win ? "🏆 Победа!" : rank ? `${rank}-е место` : "Бой окончен"}
                  </div>
                );
              })() : (
                <>
                  <div style={{ fontSize: 40, fontWeight: 900, color: result.winner === (connRef.current?.getTeam() ?? "blue") ? "#7CFF6B" : "#ff6b6b" }}>
                    {result.winner === "draw" ? "Ничья" : result.winner === (connRef.current?.getTeam() ?? "blue") ? "Победа!" : "Поражение"}
                  </div>
                  <div style={{ color: "#cfe0f5", fontSize: 22, fontWeight: 700 }}>
                    <span style={{ color: "#3da5ff" }}>{result.score.blue}</span> : <span style={{ color: "#ff5252" }}>{result.score.red}</span>
                  </div>
                </>
              )}
              {myReward && (
                <div style={{ display: "flex", gap: 18, alignItems: "center", background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: "10px 18px", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <RewardItem color={myReward.trophyDelta >= 0 ? "#ffd54a" : "#ff6b6b"} icon="🏆" value={`${myReward.trophyDelta >= 0 ? "+" : ""}${myReward.trophyDelta}`} />
                  <RewardItem color="#ffcf4a" icon="🪙" value={`+${myReward.coins}`} />
                  <RewardItem color="#8fd0ff" icon="XP" value={`+${myReward.xp}`} />
                </div>
              )}
              {onlineStats && (
                <div style={{ color: "#9fe9df", fontSize: 13, fontWeight: 700 }}>
                  🏆 {onlineStats.trophies} · побед {onlineStats.wins}/{onlineStats.battles}
                </div>
              )}
              {result.scoreboard.length > 0 && (
                <div style={{ width: "min(520px,92vw)", maxHeight: "38vh", overflowY: "auto", background: "rgba(0,0,0,0.35)", borderRadius: 12, padding: 8 }}>
                  {result.scoreboard.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 44px 44px 60px", alignItems: "center", gap: 8,
                        padding: "6px 10px", borderRadius: 8, marginBottom: 4, fontSize: 14,
                        background: FFA_MODES.has(mode)
                          ? (row.id === youId.current ? "rgba(124,255,107,0.12)" : "rgba(255,255,255,0.05)")
                          : (row.t === (teamRef.current ?? 0) ? "rgba(61,165,255,0.14)" : "rgba(255,82,82,0.12)"),
                        color: "#e7eefb", fontWeight: row.id === youId.current ? 800 : 600,
                        outline: row.id === youId.current ? "1px solid #7CFF6B" : "none",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.rank ? `${row.rank}. ` : (row.mvp ? "⭐ " : "")}{row.name}{row.bot ? " 🤖" : ""}
                      </span>
                      <span title="убийства" style={{ textAlign: "center" }}>⚔ {row.kills}</span>
                      <span title={(mode === "showdown" || mode === "megashowdown") ? "кубы силы" : "кристаллы"} style={{ textAlign: "center" }}>{(mode === "showdown" || mode === "megashowdown") ? "⬢" : "◆"} {row.gems}</span>
                      <span style={{ textAlign: "right", color: row.trophyDelta >= 0 ? "#ffd54a" : "#ff6b6b", fontWeight: 800 }}>
                        {row.trophyDelta >= 0 ? "+" : ""}{row.trophyDelta}🏆
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={onExit} style={primaryBtn}>В меню</button>
            </>
          ) : (
            <>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, textAlign: "center", padding: "0 24px" }}>{status}</div>
              {phase !== "error" && <Spinner />}
              {phase === "error" && <button onClick={onExit} style={primaryBtn}>Назад</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreChip({ color, value, cd, icon }: { color: string; value: number; cd: number; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 999, border: `2px solid ${color}` }}>
      <span style={{ color, fontWeight: 900, fontSize: 22 }}>{value}</span>
      <span style={{ color: "#23e0c8" }}>{icon}</span>
      {cd > 0 && <span style={{ color: "#ffd54a", fontWeight: 800, fontSize: 14 }}>{cd}</span>}
    </div>
  );
}

function RewardItem({ color, icon, value }: { color: string; icon: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 48 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ color, fontWeight: 900, fontSize: 18 }}>{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width: 36, height: 36, border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "12px 28px", borderRadius: 12, border: "none",
  background: "linear-gradient(180deg,#ffd54a,#ff9e00)", color: "#ffffff", fontWeight: 800, fontSize: 16,
  textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
};
