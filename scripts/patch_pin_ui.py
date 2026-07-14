# -*- coding: utf-8 -*-
"""Batch UI patches for collectible pins."""
from pathlib import Path
import re

ROOT = Path(".")

def fix_div_closings(text: str) -> str:
    return re.sub(r"</(div)(\s*\n)", r"</\1>\2", text)

# ── RewardDropModal ───────────────────────────────────────────────────────
p = ROOT / "src/components/RewardDropModal.tsx"
s = p.read_text(encoding="utf-8")
if '"pin"' not in s.split("RewardInfo")[1][:200]:
    s = s.replace(
        'export interface RewardInfo {\n  type: "coins" | "gems" | "powerPoints" | "chest" | "xp";',
        'export interface RewardInfo {\n  type: "coins" | "gems" | "powerPoints" | "chest" | "xp" | "pin";',
    )
    s = s.replace(
        '  chestRarity?: ChestRarity;\n  label: string;\n}',
        '  chestRarity?: ChestRarity;\n  pinId?: string;\n  goldenPinFrame?: boolean;\n  label: string;\n}',
    )
if 'import PinIcon' not in s:
    s = s.replace(
        'import ChestVisual from "./ChestVisual";',
        'import ChestVisual from "./ChestVisual";\nimport PinIcon from "./PinIcon";',
    )
if 'reward.type === "pin"' not in s:
    pin_block = '''
      {reward.type === "pin" && reward.pinId && (
        <div style={{ animation: "rdmPopUp 0.45s 0.05s ease both", marginBottom: 20 }}>
          <PinIcon pinId={reward.pinId} size={120} glow animated />
        </div>
      )}

'''
    s = s.replace('{/* Static visual for chest rewards */}', pin_block + '      {/* Static visual for chest rewards */}')
    s = s.replace(
        'const glow  = GLOW[reward.type] ?? "#FFD700";',
        'const glow  = reward.type === "pin" ? "#CE93D8" : (GLOW[reward.type] ?? "#FFD700");',
    )
p.write_text(s, encoding="utf-8")

# ── ClashPassPage ─────────────────────────────────────────────────────────
p = ROOT / "src/pages/ClashPassPage.tsx"
s = p.read_text(encoding="utf-8")
if 'import PinIcon' not in s:
    s = s.replace(
        'import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";',
        'import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";\nimport PinIcon from "../components/PinIcon";',
    )
if 'r.type === "pin"' not in s:
    s = s.replace(
        '  if (r.type === "chest") return "#FF7043";\n  return "#FFD700";',
        '  if (r.type === "chest") return "#FF7043";\n  if (r.type === "pin") return "#CE93D8";\n  return "#FFD700";',
    )
    s = s.replace(
        '  if (r.type === "powerPoints") return <PowerIcon size={size} />;\n  return <CoinIcon size={size} />;',
        '  if (r.type === "powerPoints") return <PowerIcon size={size} />;\n  if (r.type === "pin" && r.pinId) {\n    return <PinIcon pinId={r.pinId} size={size} glow animated />;\n  }\n  return <CoinIcon size={size} />;',
    )
    s = s.replace(
        '        chestRarity: r.reward.chestRarity,\n        label: r.reward.label,',
        '        chestRarity: r.reward.chestRarity,\n        pinId: r.reward.pinId,\n        goldenPinFrame: r.reward.goldenPinFrame,\n        label: r.reward.label,',
    )
p.write_text(s, encoding="utf-8")

# ── dailyDeals ────────────────────────────────────────────────────────────
p = ROOT / "src/utils/dailyDeals.ts"
s = p.read_text(encoding="utf-8")
if '| { kind: "pin"' not in s:
    s = s.replace(
        '  | { kind: "pet";         petId: string }\n  | { kind: "upgradeDiscount"; percent: number; uses: number };',
        '  | { kind: "pet";         petId: string }\n  | { kind: "pin";          pinId: string }\n  | { kind: "upgradeDiscount"; percent: number; uses: number };',
    )
if 'grantPin' not in s:
    s = s.replace(
        '  getCurrentProfile, updateProfile, addCoins, addGems, grantChest,\n} from "./localStorageAPI";',
        '  getCurrentProfile, updateProfile, addCoins, addGems, grantChest, grantPin,\n} from "./localStorageAPI";',
    )
if 'SHOP_PIN_DEAL_IDS' not in s:
    s = s.replace(
        'import { PETS, PET_GEM_COST, type PetRarity } from "../entities/PetData";',
        'import { PETS, PET_GEM_COST, type PetRarity } from "../entities/PetData";\nimport {\n  COLLECTIBLE_PIN_GEM_COST, SHOP_PIN_DEAL_IDS, getCollectiblePin,\n} from "../entities/CollectiblePinData";',
    )
if 'deal_pin_' not in s:
    pin_deals = '''
  // Collectible pin deals (shop tab overlap)
  SHOP_PIN_DEAL_IDS.forEach(pinId => {
    const def = getCollectiblePin(pinId);
    if (!def) return;
    const base = COLLECTIBLE_PIN_GEM_COST[def.rarity];
    const discounted = Math.max(5, Math.round(base * 0.8 / 5) * 5);
    const w = def.rarity === "common" ? 10 : def.rarity === "rare" ? 8 : def.rarity === "epic" ? 5 : 3;
    out.push({
      id: `deal_pin_${pinId}`,
      title: `Пин «${def.label}»`,
      items: [{ kind: "pin", pinId }],
      priceCurrency: "gems",
      priceAmount: discounted,
      baselineAmount: base,
      weight: w,
      category: "discount",
      iconColor: def.color,
    });
  });

'''
    s = s.replace('  return out;\n}', pin_deals + '  return out;\n}', 1)
if 'case "pin":' not in s.split('grantDealItem')[1][:800]:
    s = s.replace(
        '    case "upgradeDiscount": {',
        '''    case "pin": {
      grantPin(item.pinId);
      break;
    }
    case "upgradeDiscount": {''',
    )
p.write_text(s, encoding="utf-8")

# ── DailyDealsSection ─────────────────────────────────────────────────────
p = ROOT / "src/components/DailyDealsSection.tsx"
s = p.read_text(encoding="utf-8")
if 'import PinIcon' not in s:
    s = s.replace('import PetSvg from "./PetSvg";', 'import PetSvg from "./PetSvg";\nimport PinIcon from "./PinIcon";\nimport { getCollectiblePin } from "../entities/PinData";')
if 'item.kind === "pin"' not in s:
    s = s.replace(
        '  if (item.kind === "upgradeDiscount") {',
        '''  if (item.kind === "pin") {
    const def = getCollectiblePin(item.pinId);
  return (
      <span style={{ ...chip(def?.color ?? "#CE93D8"), padding: "2px 8px 2px 4px" }}>
        <PinIcon pinId={item.pinId} size={22} animated={false} /> {def?.label ?? item.pinId}
      </span>
    );
  }
  if (item.kind === "upgradeDiscount") {''',
    )
p.write_text(fix_div_closings(s), encoding="utf-8")

# ── ShopPage PinsShopTab ──────────────────────────────────────────────────
p = ROOT / "src/pages/ShopPage.tsx"
s = p.read_text(encoding="utf-8")
if 'COLLECTIBLE_PINS' not in s:
    s = s.replace(
        '} from "../entities/PinData";',
        '} from "../entities/PinData";\nimport {\n  COLLECTIBLE_PINS, COLLECTIBLE_PIN_RARITY_LABEL,\n  type CollectiblePinRarity,\n} from "../entities/CollectiblePinData";',
    )
if 'КОЛЛЕКЦИОННЫЕ' not in s:
    shop_section = '''
      <div style={{ marginBottom: 22 }}>
        <SectionLabel color="#CE93D8" text="🎮 КОЛЛЕКЦИОННЫЕ ПИНЫ — для общих слотов" />
        {(["common", "rare", "epic", "unique", "golden"] as CollectiblePinRarity[]).map(rarity => (
          <div key={rarity} style={{ marginBottom: 16 }}>
            <motionPinModalHeader
          </motionPinModalHeader
        ))}
      </motionPinModalHeader

'''
    shop_section = shop_section.replace("motionPinModalHeader", "motionPinModalHeader")
    shop_section = '''      <div style={{ marginBottom: 22 }}>
        <SectionLabel color="#CE93D8" text="🎮 КОЛЛЕКЦИОННЫЕ ПИНЫ — для общих слотов" />
        {(["common", "rare", "epic", "unique", "golden"] as CollectiblePinRarity[]).map(rarity => (
          <div key={rarity} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#CE93D8", marginBottom: 8 }}>
              {COLLECTIBLE_PIN_RARITY_LABEL[rarity].toUpperCase()}
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 12,
            }}>
              {COLLECTIBLE_PINS.filter(p => p.rarity === rarity).map(p => {
                const isOwned = owned.has(p.id);
                const cost = pinCostGems(p.id);
                const canBuy = !isOwned && profileGems >= cost;
                return (
                  <div key={p.id} className="ui-glass" style={{
                    padding: "10px 6px", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 6, borderRadius: 14,
                    border: `1px solid ${isOwned ? "#76FF03" : "rgba(255,255,255,0.10)"}`,
                  }}>
                    <PinIcon pinId={p.id} size={62} locked={!isOwned} glow={canBuy} animated />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "white", textAlign: "center" }}>{p.label}</div>
                    {isOwned ? (
                      <div style={{ fontSize: 9, color: "#76FF03", fontWeight: 900 }}>✓ КУПЛЕНО</div>
                    ) : (
                      <button onClick={() => onBuy(p.id)} disabled={!canBuy} style={{
                        background: canBuy ? "linear-gradient(135deg, #7E57C2, #4527A0)" : "rgba(255,255,255,0.08)",
                        color: canBuy ? "white" : "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8,
                        padding: "5px 10px", fontSize: 11, fontWeight: 800,
                        cursor: canBuy ? "pointer" : "not-allowed",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <GemIcon size={11} /> {cost}
                      </button>
                    )}
                  </motionPinModalHeader
                );
              })}
            </motionPinModalHeader
          </motionPinModalHeader
        ))}
      </motionPinModalHeader

'''
    shop_section = shop_section.replace("motionPinModalHeader", "div")
    s = s.replace(
        '      {/* Per-character pin shelves */}',
        shop_section + '      {/* Per-character pin shelves */}',
    )
p.write_text(s, encoding="utf-8")

print("patched ui files")
