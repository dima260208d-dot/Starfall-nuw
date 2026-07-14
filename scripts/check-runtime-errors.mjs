import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:5173/";
const errors = [];
const consoleErrors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("clashArena_currentUser", "playwright_test");
});
const page = await context.newPage();

page.on("pageerror", (err) => {
  errors.push(`PAGEERROR: ${err.message}\n${err.stack ?? ""}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`CONSOLE: ${msg.text()}`);
});

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(15000);
  const bodyText = await page.locator("body").innerText();
  if (/too many re-renders/i.test(bodyText)) {
    errors.push("PAGEERROR: Too many re-renders visible in DOM");
  }
} catch (e) {
  errors.push(`NAV: ${e.message}`);
}

await browser.close();

const criticalConsole = consoleErrors.filter(
  (e) => !e.includes("404") && !e.includes("Failed to load resource"),
);

if (errors.length || criticalConsole.length) {
  console.log("=== RUNTIME ISSUES ===");
  for (const e of errors) console.log(e);
  for (const e of criticalConsole) console.log(e);
  process.exit(1);
}

console.log("OK: no critical runtime errors in 15s on", URL);
