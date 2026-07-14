# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("src/pages/AdminPanel.tsx")
s = p.read_text(encoding="utf-8")

if "listGiftPinOptions" not in s:
    s = s.replace(
        '  type GiftItem,\n} from "../utils/gifts";',
        '  listGiftPinOptions,\n  type GiftItem,\n} from "../utils/gifts";',
    )

pin_option = '                    <option value="pin">Пин</option>\n'

for block in [
    '                    <option value="brawler">Боец</option>\n                  </select>',
]:
    if 'value="pin"' not in s[s.find(block)-200:s.find(block)+len(block)] if block in s else "":
        pass

# gift personal select
s = s.replace(
    '                    <option value="brawler">Боец</option>\n                  </select>\n                  <GiftItemInputs item={it}',
    '                    <option value="brawler">Боец</option>\n                    <option value="pin">Коллекционный пин</option>\n                  </select>\n                  <GiftItemInputs item={it}',
    1,
)
# broadcaster select  
s = s.replace(
    '                <option value="brawler">Боец</option>\n              </select>\n              <GiftItemInputs item={it}',
    '                <option value="brawler">Боец</option>\n                <option value="pin">Коллекционный пин</option>\n              </select>\n              <GiftItemInputs item={it}',
    1,
)

# switch cases - personal gift
s = s.replace(
    '                      case "brawler": next = { kind, brawlerId: BRAWLERS[0].id }; break;\n                    }',
    '                      case "brawler": next = { kind, brawlerId: BRAWLERS[0].id }; break;\n                      case "pin": next = { kind, pinId: listGiftPinOptions()[0]?.id ?? "g_coin_stack" }; break;\n                    }',
    1,
)
s = s.replace(
    '      case "brawler":     next = { kind, brawlerId: BRAWLERS[0].id }; break;\n    }',
    '      case "brawler":     next = { kind, brawlerId: BRAWLERS[0].id }; break;\n      case "pin":         next = { kind, pinId: listGiftPinOptions()[0]?.id ?? "g_coin_stack" }; break;\n    }',
    1,
)

# GiftItemInputs pin
if 'item.kind === "pin"' not in s.split("function GiftItemInputs")[1][:600]:
    s = s.replace(
        '  if (item.kind === "brawler") {\n    return (\n      <select value={item.brawlerId}',
        '''  if (item.kind === "pin") {
    return (
      <select value={item.pinId} onChange={e => onChange({ kind: "pin", pinId: e.target.value })} style={inputStyle()}>
        {listGiftPinOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (item.kind === "brawler") {
    return (
      <select value={item.brawlerId}''',
    )

# deals
if 'case "pin":' not in s.split("function describeDealItem")[1][:400]:
    s = s.replace(
        '    case "upgradeDiscount":  return `купон −${it.percent}% ×${it.uses}`;',
        '    case "pin":              return `Пин «${getCollectiblePin(it.pinId)?.label ?? it.pinId}»`;\n    case "upgradeDiscount":  return `купон −${it.percent}% ×${it.uses}`;',
    )
if 'getCollectiblePin' not in s:
    s = s.replace(
        'import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../utils/chests";',
        'import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../utils/chests";\nimport { getCollectiblePin } from "../entities/PinData";',
    )

s = s.replace(
    '      case "upgradeDiscount": next = { kind, percent: 10, uses: 1 }; break;\n    }',
    '      case "pin":             next = { kind, pinId: listGiftPinOptions()[0]?.id ?? "g_coin_stack" }; break;\n      case "upgradeDiscount": next = { kind, percent: 10, uses: 1 }; break;\n    }',
    1,
)
s = s.replace(
    '              <option value="upgradeDiscount">Купон апгрейда</option>\n            </select>',
    '              <option value="pin">Коллекционный пин</option>\n              <option value="upgradeDiscount">Купон апгрейда</option>\n            </select>',
    1,
)

if 'item.kind === "pin"' not in s.split("function ItemInputs")[1][:500]:
    s = s.replace(
        '  if (item.kind === "upgradeDiscount") {',
        '''  if (item.kind === "pin") {
    return (
      <select value={item.pinId} onChange={e => onChange({ pinId: e.target.value } as any)} style={inputStyle()}>
        {listGiftPinOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (item.kind === "upgradeDiscount") {''',
    )

p.write_text(s, encoding="utf-8")
print("admin patched")
