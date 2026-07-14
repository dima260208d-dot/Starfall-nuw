import { resolveSeatInput } from "../../src/server/headlessServerTick.ts";

const fired = { mx: 0, my: -1, ax: 1, ay: 0, attack: true, super: false, manual: true, pending: true };
const held = resolveSeatInput(undefined, fired);
if (held.attack) {
  console.error("FAIL: attack must not repeat without fresh input");
  process.exit(1);
}
if (held.my !== -1) {
  console.error("FAIL: movement should be held");
  process.exit(1);
}
console.log("resolveSeatInput OK");
