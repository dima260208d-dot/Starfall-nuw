import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAWLER_RARITY_LABEL, MAX_BRAWLER_LEVEL } from "../../entities/BrawlerData";
import { PET_RARITY_LABEL, type PetRarity } from "../../entities/PetData";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../../utils/chests";
import {
  applyPercentDelta,
  loadCharacterBalanceOverrides,
  materializePriceCategory,
  resetCharacterBalanceOverrides,
  resolveBrawlerGemCost,
  resolveChestGemPrice,
  resolvePetGemCost,
  saveCharacterBalanceOverrides,
  subscribeCharacterBalanceChanges,
  type CharacterBalanceOverrides,
  type CharacterEconomyOverrides,
  type PriceSyncCategory,
} from "../../utils/characterBalance";
import { commitAdminAction } from "../../utils/adminScheduler";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";
import AdminPercentField, { adminBtn } from "./AdminPercentField";

const BRAWLER_RARITIES = CHEST_RARITY_ORDER;
const PET_RARITIES: PetRarity[] = ["common", "rare", "epic", "mythic", "legendary"];

const SYNC_OPTIONS: { value: PriceSyncCategory; label: string }[] = [
  { value: "none", label: "Индивидуально" },
  { value: "brawler", label: "Как у бойцов" },
  { value: "pet", label: "Как у питомцев" },
  { value: "chest", label: "Как у сундуков" },
];

function syncOptionsFor(category: "brawler" | "pet" | "chest") {
  return SYNC_OPTIONS.filter(o => o.value === "none" || o.value !== category);
}

function PriceSyncSelect({
  category,
  value,
  onChange,
}: {
  category: "brawler" | "pet" | "chest";
  value: PriceSyncCategory;
  onChange: (mode: PriceSyncCategory) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 10 }}>
      <span style={{ opacity: 0.75 }}>Синхронизация:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as PriceSyncCategory)}
        style={{ flex: 1, maxWidth: 220, padding: "5px 8px", borderRadius: 6, fontSize: 11 }}
      >
        {syncOptionsFor(category).map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function AdminEconomyTab() {
  const [draft, setDraft] = useState<CharacterBalanceOverrides>(() => loadCharacterBalanceOverrides());
  const [saved, setSaved] = useState<CharacterBalanceOverrides>(() => loadCharacterBalanceOverrides());
  const [status, setStatus] = useState("");
  const [bulkPct, setBulkPct] = useState(10);
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const economy = draft.economy;

  const reload = useCallback(() => {
    const o = loadCharacterBalanceOverrides();
    setDraft(JSON.parse(JSON.stringify(o)));
    setSaved(JSON.parse(JSON.stringify(o)));
  }, []);

  useEffect(() => subscribeCharacterBalanceChanges(reload), [reload]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const patchEconomy = (patch: CharacterEconomyOverrides) => {
    setDraft(d => ({ ...d, economy: { ...d.economy, ...patch } }));
  };

  const setPriceSync = (category: "brawler" | "pet" | "chest", mode: PriceSyncCategory) => {
    const e = draft.economy ?? {};
    if (mode === "none" && e.priceSync?.[category] && e.priceSync[category] !== "none") {
      patchEconomy(materializePriceCategory(e, category));
      return;
    }
    patchEconomy({ priceSync: { ...e.priceSync, [category]: mode } });
  };

  const ensureIndividual = (category: "brawler" | "pet" | "chest"): CharacterEconomyOverrides => {
    const e = draft.economy ?? {};
    if (e.priceSync?.[category] && e.priceSync[category] !== "none") {
      return materializePriceCategory(e, category);
    }
    return e;
  };

  const patchBrawlerCost = (rarity: ChestRarity, gems: number) => {
    const e = ensureIndividual("brawler");
    patchEconomy({ ...e, brawlerGemCost: { ...e.brawlerGemCost, [rarity]: gems } });
  };

  const patchPetCost = (rarity: PetRarity, gems: number) => {
    const e = ensureIndividual("pet");
    patchEconomy({ ...e, petGemCost: { ...e.petGemCost, [rarity]: gems } });
  };

  const patchChestPrice = (rarity: ChestRarity, priceGems: number) => {
    const e = ensureIndividual("chest");
    patchEconomy({
      ...e,
      chestPrices: {
        ...e.chestPrices,
        [rarity]: { ...e.chestPrices?.[rarity], priceGems },
      },
    });
  };

  const applyBulkPercent = (target: "brawler" | "pet" | "chestGems" | "upgrade") => {
    let e = draft.economy ?? {};
    if (target === "brawler") {
      e = ensureIndividual("brawler");
      const next: Partial<Record<ChestRarity, number>> = { ...e.brawlerGemCost };
      for (const r of BRAWLER_RARITIES) {
        const cur = resolveBrawlerGemCost(r, e);
        next[r] = applyPercentDelta(cur, bulkPct);
      }
      patchEconomy({ ...e, brawlerGemCost: next });
    } else if (target === "pet") {
      e = ensureIndividual("pet");
      const next: Partial<Record<PetRarity, number>> = { ...e.petGemCost };
      for (const r of PET_RARITIES) {
        const cur = resolvePetGemCost(r, e);
        next[r] = applyPercentDelta(cur, bulkPct);
      }
      patchEconomy({ ...e, petGemCost: next });
    } else if (target === "chestGems") {
      e = ensureIndividual("chest");
      const next = { ...e.chestPrices };
      for (const r of BRAWLER_RARITIES) {
        const cur = resolveChestGemPrice(r, e);
        next[r] = { ...next[r], priceGems: applyPercentDelta(cur, bulkPct) };
      }
      patchEconomy({ ...e, chestPrices: next });
    } else if (target === "upgrade") {
      const table = { ...e.upgradeCostsByLevel };
      for (let lv = 1; lv < MAX_BRAWLER_LEVEL; lv++) {
        const row = table[lv] ?? { coins: 100 * lv, powerPoints: 25 * lv };
        table[lv] = {
          coins: applyPercentDelta(row.coins, bulkPct),
          powerPoints: applyPercentDelta(row.powerPoints, bulkPct),
        };
      }
      patchEconomy({ ...e, upgradeCostsByLevel: table });
    }
    setStatus(`Применено ${bulkPct > 0 ? "+" : ""}${bulkPct}%`);
  };

  const commitSave = () => {
    const r = commitAdminAction({
      domain: "character_balance_save",
      label: "Экономика: стоимости",
      schedule,
      payload: { overrides: draft, mode: "merge" as const },
    });
    setStatus(r.message);
    if (r.immediate) {
      saveCharacterBalanceOverrides(draft, "merge");
      setSaved(JSON.parse(JSON.stringify(draft)));
      resetSchedule();
    }
  };

  const brawlerSync = economy?.priceSync?.brawler ?? "none";
  const petSync = economy?.priceSync?.pet ?? "none";
  const chestSync = economy?.priceSync?.chest ?? "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {isDirty && <span style={{ fontSize: 11, color: "#FFD740", fontWeight: 800 }}>● Не сохранено</span>}
        <span style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          Массово ±%
          <input type="number" value={bulkPct} onChange={e => setBulkPct(Number(e.target.value))} style={{ width: 56, padding: 4, borderRadius: 6 }} />
        </label>
        <button type="button" style={adminBtn("#B39DDB")} onClick={() => applyBulkPercent("brawler")}>±% бойцы</button>
        <button type="button" style={adminBtn("#B39DDB")} onClick={() => applyBulkPercent("pet")}>±% питомцы</button>
        <button type="button" style={adminBtn("#B39DDB")} onClick={() => applyBulkPercent("chestGems")}>±% сундуки 💎</button>
        <button type="button" style={adminBtn("#B39DDB")} onClick={() => applyBulkPercent("upgrade")}>±% прокачка</button>
        <button type="button" style={adminBtn("#81C784")} disabled={!isDirty} onClick={commitSave}>💾 Сохранить</button>
        <button type="button" style={adminBtn("#FF8A80")} disabled={!isDirty} onClick={() => setDraft(JSON.parse(JSON.stringify(saved)))}>↩ Отменить</button>
        <button type="button" style={adminBtn("#888")} onClick={() => { resetCharacterBalanceOverrides(); reload(); }}>🗑 Сброс</button>
      </div>

      <AdminScheduleControls schedule={schedule} onChange={setSchedule} />
      {status && <div style={{ fontSize: 11, color: "#FFD740" }}>{status}</div>}

      <div className="ui-glass" style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 6 }}>💎 Стоимость бойцов по редкости</div>
        <PriceSyncSelect category="brawler" value={brawlerSync} onChange={m => setPriceSync("brawler", m)} />
        {brawlerSync !== "none" && (
          <div style={{ fontSize: 10, color: "#81D4FA", marginBottom: 8 }}>
            Цены синхронизированы с «{SYNC_OPTIONS.find(o => o.value === brawlerSync)?.label.replace("Как у ", "")}». Смените на «Индивидуально», чтобы редактировать вручную.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {BRAWLER_RARITIES.map(r => (
            <AdminPercentField
              key={r}
              label={`${BRAWLER_RARITY_LABEL[r]} (кристаллы)`}
              value={resolveBrawlerGemCost(r, economy)}
              onChange={v => patchBrawlerCost(r, v)}
              disabled={brawlerSync !== "none"}
            />
          ))}
        </div>
      </div>

      <div className="ui-glass" style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 6 }}>🐾 Стоимость питомцев по редкости</div>
        <PriceSyncSelect category="pet" value={petSync} onChange={m => setPriceSync("pet", m)} />
        {petSync !== "none" && (
          <div style={{ fontSize: 10, color: "#81D4FA", marginBottom: 8 }}>
            Цены синхронизированы с «{SYNC_OPTIONS.find(o => o.value === petSync)?.label.replace("Как у ", "")}».
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {PET_RARITIES.map(r => (
            <AdminPercentField
              key={r}
              label={`${PET_RARITY_LABEL[r]} (кристаллы)`}
              value={resolvePetGemCost(r, economy)}
              onChange={v => patchPetCost(r, v)}
              disabled={petSync !== "none"}
            />
          ))}
        </div>
      </div>

      <div className="ui-glass" style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 6 }}>📦 Стоимость сундуков (только кристаллы)</div>
        <PriceSyncSelect category="chest" value={chestSync} onChange={m => setPriceSync("chest", m)} />
        {chestSync !== "none" && (
          <div style={{ fontSize: 10, color: "#81D4FA", marginBottom: 8 }}>
            Цены синхронизированы с «{SYNC_OPTIONS.find(o => o.value === chestSync)?.label.replace("Как у ", "")}».
            Мега и ультра без аналога у питомцев всегда настраиваются отдельно при синхронизации с питомцами.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {BRAWLER_RARITIES.map(r => {
            const syncedFromPet = chestSync === "pet" && (r === "mega" || r === "ultralegendary");
            const fieldDisabled = chestSync !== "none" && !syncedFromPet;
            return (
              <div key={r} style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>{CHESTS[r].name}</div>
                <AdminPercentField
                  label="Кристаллы"
                  value={resolveChestGemPrice(r, economy)}
                  onChange={v => patchChestPrice(r, v)}
                  disabled={fieldDisabled}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="ui-glass" style={{ padding: 12, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
        Стоимость прокачки бойцов (монеты + очки силы по уровням) настраивается во вкладке «Персонажи» → «Поменять ресурсы» и применяется ко всем бойцам сразу.
        Сундуки в игре покупаются только за кристаллы.
      </div>
    </div>
  );
}
