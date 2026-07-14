#!/usr/bin/env node
/** Seed feature news items (local + optional server publish). */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cdn = "https://starfall-assets-cdn.dima260208.workers.dev/cdn/";

const items = [
  {
    id: "news_feat_reports_v1",
    title: "🚩 Жалобы на игроков",
    body: "На экране результата — кнопка «Пожаловаться». Выберите категорию и отправьте жалобу на сервер. 100 жалоб за 5 дней → проверка модераторами.",
    imageUrl: `${cdn}news/game-process/news-report-system.png`,
    categoryId: "updates",
  },
  {
    id: "news_feat_haptics_v1",
    title: "📳 Отдача и вибрация в бою",
    body: "Лёгкая вибрация при попадании, сильная при смерти. Отключите в Настройки → Звук.",
    imageUrl: `${cdn}news/game-process/news-haptics.png`,
    categoryId: "updates",
  },
  {
    id: "news_feat_hud_v1",
    title: "🛰️ Новый HUD боя",
    body: "Миникарта убрана. Слева вверху — счётчик врагов/команд. Подсказки Астрала справа. Можно отключить в настройках.",
    imageUrl: `${cdn}news/game-process/news-hud-update.png`,
    categoryId: "updates",
  },
  {
    id: "news_feat_gesture_v1",
    title: "🕹️ Редактор джойстиков",
    body: "В тренировке настройте джойстики: фиксированные или плавающие, размер, зеркало, кнопки эмодзи и автобоя.",
    imageUrl: `${cdn}news/game-process/news-gesture-editor.png`,
    categoryId: "updates",
  },
];

function readEnvLocal() {
  const out = {};
  const p = join(root, ".env.local");
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnvLocal(), ...process.env };
const base = (env.VITE_CONFIG_SERVER_URL || "http://217.60.245.116/cfg").replace(/\/$/, "");
const token = env.ADMIN_CONFIG_TOKEN || "";
const gate = env.ADMIN_GATE_KEY || env.VITE_ADMIN_GATE_KEY || "";

async function main() {
  console.log("[seed-feature-news] items:", items.length);
  if (!token) {
    console.log("Set ADMIN_CONFIG_TOKEN in .env.local to publish to server.");
    return;
  }
  for (const item of items) {
    let res = await fetch(`${base}/admin/draft`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(gate ? { "x-admin-gate": gate } : {}),
      },
      body: JSON.stringify({ domain: "news", value: { merge: item } }),
    });
    console.log("draft", item.id, res.status);
  }
  console.log("Done — run full news snapshot publish from admin panel or merge manually.");
}

main().catch((e) => { console.error(e); process.exit(1); });
