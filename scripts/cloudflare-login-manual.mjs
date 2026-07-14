#!/usr/bin/env node
/**
 * Вход в Cloudflare без автоматического localhost-callback.
 * Подходит если Яндекс.Браузер ломает oauth (страница не найдена на localhost).
 */
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(root, "cloudflare-worker");

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Cloudflare — вход БЕЗ localhost (для Яндекс.Браузера)      ║
╚══════════════════════════════════════════════════════════════╝

Сейчас откроется ссылка. Делайте ТАК:

1. Скопируйте ссылку из терминала и откройте в **Chrome** или **Edge**
   (не Яндекс — он часто ломает localhost).

2. Нажмите «Allow» на сайте Cloudflare.

3. Браузер перейдёт на localhost — страница может быть пустой/ошибка.
   Это НОРМАЛЬНО. Скопируйте ВЕСЬ адрес из строки браузера, например:
   http://localhost:8976/oauth/callback?code=...&state=...

4. Вставьте этот адрес в этот терминал и нажмите Enter.

Альтернатива (ещё проще): API-токен — см. infra/CLOUDFLARE-WORKER-R2.ru.md раздел «Вход через токен»
`);

const child = spawn("npx", ["wrangler", "login", "--browser=false"], {
  cwd: workerDir,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("\n✅ Вход успешен! Дальше: npm run cf:setup\n");
  } else {
    console.log("\n❌ Не вышло. Попробуйте вход через API-токен (инструкция в infra/CLOUDFLARE-WORKER-R2.ru.md)\n");
    process.exit(code ?? 1);
  }
});
