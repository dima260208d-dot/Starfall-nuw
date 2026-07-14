import { useCallback, useEffect, useMemo, useState } from "react";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../../utils/chests";
import { CHEST_BRAWLER_DROP_CHANCE } from "../../entities/BrawlerData";
import { CHEST_PET_DROP_CHANCE } from "../../entities/PetData";
import { CHEST_PIN_DROP_CHANCE } from "../../entities/CollectiblePinData";
import { CHEST_PROFILE_ICON_DROP_CHANCE } from "../../utils/profileIconUtils";
import {
  applyPercentDelta,
  CHEST_RARITY_LABEL_RU,
  resolveChestDrops,
  loadChestBalanceOverrides,
  resetChestBalanceOverrides,
  saveChestBalanceOverrides,
  subscribeChestBalanceChanges,
  type ChestBalanceOverrides,
  type ChestExtraDropRule,
  type ChestRarityOverride,
} from "../../utils/chestBalance";
import { commitAdminAction } from "../../utils/adminScheduler";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";
import AdminPercentField, { adminBtn } from "./AdminPercentField";

const ROLL_TYPES = ["coins", "gems", "powerPoints", "brawler", "pet", "pin", "profileIcon"] as const;

function newExtraDrop(): ChestExtraDropRule {
  return { id: `extra_${Date.now()}`, type: "coins", chance: 0.1, amountMin: 10, amountMax: 50, enabled: true };
}

export default function AdminChestsTab() {
  const [draft, setDraft] = useState<ChestBalanceOverrides>(() => loadChestBalanceOverrides());
  const [saved, setSaved] = useState<ChestBalanceOverrides>(() => loadChestBalanceOverrides());
  const [activeRarity, setActiveRarity] = useState<ChestRarity>("common");
  const [status, setStatus] = useState("");
  const [bulkPct, setBulkPct] = useState(10);
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const reload = useCallback(() => {
    const o = loadChestBalanceOverrides();
    setDraft(JSON.parse(JSON.stringify(o)));
    setSaved(JSON.parse(JSON.stringify(o)));
  }, []);

  useEffect(() => subscribeChestBalanceChanges(reload), [reload]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const patchChest = (rarity: ChestRarity, patch: ChestRarityOverride) => {
    setDraft(d => ({
      ...d,
      chests: {
        ...d.chests,
        [rarity]: { ...d.chests?.[rarity], ...patch, drops: { ...d.chests?.[rarity]?.drops, ...patch.drops } },
      },
    }));
  };

  const patchDrop = (field: string, value: number | [number, number]) => {
    const cur = resolveChestDrops(activeRarity, draft);
    patchChest(activeRarity, { drops: { ...cur, [field]: value } });
  };

  const chest = CHESTS[activeRarity];
  const drops = resolveChestDrops(activeRarity, draft);
  const override = draft.chests?.[activeRarity] ?? {};

  const applyBulkToDrops = () => {
    const cur = { ...drops };
    const next = {
      ...cur,
      rolls: applyPercentDelta(cur.rolls, bulkPct),
      gemsChance: Math.min(1, applyPercentDelta(cur.gemsChance, bulkPct)),
      powerPointsChance: Math.min(1, applyPercentDelta(cur.powerPointsChance, bulkPct)),
      coinsRange: [applyPercentDelta(cur.coinsRange[0], bulkPct), applyPercentDelta(cur.coinsRange[1], bulkPct)] as [number, number],
      gemsRange: [applyPercentDelta(cur.gemsRange[0], bulkPct), applyPercentDelta(cur.gemsRange[1], bulkPct)] as [number, number],
      powerPointsRange: [applyPercentDelta(cur.powerPointsRange[0], bulkPct), applyPercentDelta(cur.powerPointsRange[1], bulkPct)] as [number, number],
      bonusCoins: cur.bonusCoins != null ? applyPercentDelta(cur.bonusCoins, bulkPct) : undefined,
      bonusGems: cur.bonusGems != null ? applyPercentDelta(cur.bonusGems, bulkPct) : undefined,
      bonusPowerPoints: cur.bonusPowerPoints != null ? applyPercentDelta(cur.bonusPowerPoints, bulkPct) : undefined,
      xp: applyPercentDelta(cur.xp, bulkPct),
    };
    patchChest(activeRarity, { drops: next });
    setStatus(`Ресурсы сундука ${bulkPct > 0 ? "+" : ""}${bulkPct}%`);
  };

  const commitSave = () => {
    const r = commitAdminAction({
      domain: "chest_balance_save",
      label: "Баланс сундуков",
      schedule,
      payload: { overrides: draft, mode: "merge" as const },
    });
    setStatus(r.message);
    if (r.immediate) {
      saveChestBalanceOverrides(draft, "merge");
      setSaved(JSON.parse(JSON.stringify(draft)));
      resetSchedule();
    }
  };

  const extraDrops = override.extraDrops ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {isDirty && <span style={{ fontSize: 11, color: "#FFD740", fontWeight: 800 }}>● Не сохранено</span>}
        <span style={{ flex: 1 }} />
        <button type="button" style={adminBtn("#81C784")} disabled={!isDirty} onClick={commitSave}>💾 Сохранить</button>
        <button type="button" style={adminBtn("#FF8A80")} disabled={!isDirty} onClick={() => setDraft(JSON.parse(JSON.stringify(saved)))}>↩ Отменить</button>
        <button type="button" style={adminBtn("#888")} onClick={() => { resetChestBalanceOverrides(); reload(); }}>🗑 Сброс</button>
      </div>

      <AdminScheduleControls schedule={schedule} onChange={setSchedule} />
      {status && <div style={{ fontSize: 11, color: "#FFD740" }}>{status}</div>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CHEST_RARITY_ORDER.map(r => (
          <button
            key={r}
            type="button"
            style={adminBtn(activeRarity === r ? "#FFD740" : "#888")}
            onClick={() => setActiveRarity(r)}
          >
            {CHEST_RARITY_LABEL_RU[r]}
          </button>
        ))}
      </div>

      <div className="ui-glass" style={{ padding: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{chest.name}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>{chest.description}</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11 }}>Массово к ресурсам:</span>
          <input type="number" value={bulkPct} onChange={e => setBulkPct(Number(e.target.value))} style={{ width: 56, padding: 4, borderRadius: 6 }} />
          <button type="button" style={adminBtn("#B39DDB")} onClick={applyBulkToDrops}>±% все ресурсы</button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 900, color: "#40C4FF", marginBottom: 8 }}>Основные роллы</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
          <AdminPercentField label="Кол-во роллов" value={drops.rolls} onChange={v => patchDrop("rolls", v)} />
          <AdminPercentField label="XP за открытие" value={drops.xp} onChange={v => patchDrop("xp", v)} />
          <AdminPercentField label="Шанс кристаллов (0–1)" value={drops.gemsChance} step={0.01} max={1} onChange={v => patchDrop("gemsChance", v)} />
          <AdminPercentField label="Шанс очков силы (0–1)" value={drops.powerPointsChance} step={0.01} max={1} onChange={v => patchDrop("powerPointsChance", v)} />
        </div>

        <div style={{ fontSize: 13, fontWeight: 900, color: "#FFD740", marginBottom: 8 }}>Диапазоны выпадения</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
          <AdminPercentField label="Монеты мин" value={drops.coinsRange[0]} onChange={v => patchDrop("coinsRange", [v, drops.coinsRange[1]])} />
          <AdminPercentField label="Монеты макс" value={drops.coinsRange[1]} onChange={v => patchDrop("coinsRange", [drops.coinsRange[0], v])} />
          <AdminPercentField label="Кристаллы мин" value={drops.gemsRange[0]} onChange={v => patchDrop("gemsRange", [v, drops.gemsRange[1]])} />
          <AdminPercentField label="Кристаллы макс" value={drops.gemsRange[1]} onChange={v => patchDrop("gemsRange", [drops.gemsRange[0], v])} />
          <AdminPercentField label="Очки силы мин" value={drops.powerPointsRange[0]} onChange={v => patchDrop("powerPointsRange", [v, drops.powerPointsRange[1]])} />
          <AdminPercentField label="Очки силы макс" value={drops.powerPointsRange[1]} onChange={v => patchDrop("powerPointsRange", [drops.powerPointsRange[0], v])} />
          <AdminPercentField label="Бонус монеты" value={drops.bonusCoins ?? 0} onChange={v => patchDrop("bonusCoins", v)} />
          <AdminPercentField label="Бонус кристаллы" value={drops.bonusGems ?? 0} onChange={v => patchDrop("bonusGems", v)} />
          <AdminPercentField label="Бонус очки силы" value={drops.bonusPowerPoints ?? 0} onChange={v => patchDrop("bonusPowerPoints", v)} />
        </div>

        <div style={{ fontSize: 13, fontWeight: 900, color: "#CE93D8", marginBottom: 8 }}>Шансы особых дропов</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
          <AdminPercentField
            label="Шанс бойца (базовый пол)"
            value={override.brawlerDropChance ?? CHEST_BRAWLER_DROP_CHANCE[activeRarity]}
            step={0.001}
            onChange={v => patchChest(activeRarity, { brawlerDropChance: v })}
          />
          <AdminPercentField
            label="Шанс питомца"
            value={override.petDropChance ?? CHEST_PET_DROP_CHANCE[activeRarity]}
            step={0.001}
            onChange={v => patchChest(activeRarity, { petDropChance: v })}
          />
          <AdminPercentField
            label="Шанс пина"
            value={override.pinDropChance ?? CHEST_PIN_DROP_CHANCE[activeRarity]}
            step={0.001}
            onChange={v => patchChest(activeRarity, { pinDropChance: v })}
          />
          <AdminPercentField
            label="Шанс иконки профиля"
            value={override.profileIconDropChance ?? (CHEST_PROFILE_ICON_DROP_CHANCE[activeRarity] ?? 0)}
            step={0.001}
            onChange={v => patchChest(activeRarity, { profileIconDropChance: v })}
          />
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Отключить типы дропов</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {ROLL_TYPES.map(t => {
            const disabled = (override.disabledRollTypes ?? []).includes(t);
            return (
              <button
                key={t}
                type="button"
                style={adminBtn(disabled ? "#FF8A80" : "#81C784")}
                onClick={() => {
                  const cur = override.disabledRollTypes ?? [];
                  patchChest(activeRarity, {
                    disabledRollTypes: disabled ? cur.filter(x => x !== t) : [...cur, t],
                  });
                }}
              >
                {disabled ? "✕ " : ""}{t}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 13, fontWeight: 900, color: "#FF8A65", marginBottom: 8 }}>Доп. правила выпадения</div>
        {extraDrops.map((rule, idx) => (
          <div key={rule.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 80px auto", gap: 6, marginBottom: 6, alignItems: "end" }}>
            <select
              className="ui-input"
              value={rule.type}
              onChange={e => {
                const list = [...extraDrops];
                list[idx] = { ...rule, type: e.target.value as ChestExtraDropRule["type"] };
                patchChest(activeRarity, { extraDrops: list });
              }}
            >
              {ROLL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <AdminPercentField label="Шанс" value={rule.chance} step={0.01} max={1} onChange={v => {
              const list = [...extraDrops];
              list[idx] = { ...rule, chance: v };
              patchChest(activeRarity, { extraDrops: list });
            }} />
            <input className="ui-input" type="number" placeholder="мин" value={rule.amountMin ?? ""} onChange={e => {
              const list = [...extraDrops];
              list[idx] = { ...rule, amountMin: Number(e.target.value) };
              patchChest(activeRarity, { extraDrops: list });
            }} />
            <input className="ui-input" type="number" placeholder="макс" value={rule.amountMax ?? ""} onChange={e => {
              const list = [...extraDrops];
              list[idx] = { ...rule, amountMax: Number(e.target.value) };
              patchChest(activeRarity, { extraDrops: list });
            }} />
            <button type="button" style={adminBtn(rule.enabled ? "#81C784" : "#888")} onClick={() => {
              const list = [...extraDrops];
              list[idx] = { ...rule, enabled: !rule.enabled };
              patchChest(activeRarity, { extraDrops: list });
            }}>{rule.enabled ? "Вкл" : "Выкл"}</button>
            <button type="button" style={adminBtn("#FF8A80")} onClick={() => {
              patchChest(activeRarity, { extraDrops: extraDrops.filter((_, i) => i !== idx) });
            }}>✕</button>
          </div>
        ))}
        <button type="button" style={adminBtn("#81C784")} onClick={() => patchChest(activeRarity, { extraDrops: [...extraDrops, newExtraDrop()] })}>
          + Добавить правило
        </button>
      </div>
    </div>
  );
}
