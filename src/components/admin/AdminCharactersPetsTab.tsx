import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAWLERS, BRAWLER_RARITY_LABEL, MAX_BRAWLER_LEVEL, getScaledStats } from "../../entities/BrawlerData";
import { PETS, PET_RARITY_LABEL } from "../../entities/PetData";
import BrawlerViewer3D from "../BrawlerViewer3D";
import PetSvg from "../PetSvg";
import {
  applyPercentDelta,
  BRAWLER_NUMERIC_KEYS,
  BRAWLER_STAT_LABELS_RU,
  type CharacterBalanceOverrides,
  exportCharacterBalanceJson,
  getEffectiveBrawler,
  getEffectiveBrawlerLore,
  getEffectiveConstellation,
  getEffectivePet,
  getEffectiveStarCosts,
  getEffectiveUpgradeCost,
  getUpgradeCostsTable,
  importCharacterBalanceJson,
  loadCharacterBalanceOverrides,
  petEffectFieldKeys,
  PET_EFFECT_KIND_RU,
  PET_EFFECT_LABELS_RU,
  resetCharacterBalanceOverrides,
  saveCharacterBalanceOverrides,
  subscribeCharacterBalanceChanges,
  syncBrawlerTextsOnStatChange,
  syncPetTextsOnEffectChange,
} from "../../utils/characterBalance";
import AdminPercentField, { adminBtn } from "./AdminPercentField";
import { commitAdminAction } from "../../utils/adminScheduler";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";

type Section = "brawlers" | "pets";
type ModalKind = "resources" | "balance" | "stars" | null;

function btn(color: string): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8, border: `1px solid ${color}88`,
    background: `${color}22`, color, fontWeight: 800, fontSize: 11, cursor: "pointer",
  };
}

function numInput(): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "6px 8px",
    color: "#fff", fontSize: 12, fontWeight: 700,
  };
}

function EditableRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>{label}</div>
        {edit ? (
          <textarea
            className="ui-input"
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={label.includes("опис") || label.includes("Desc") ? 3 : 1}
            style={{ width: "100%", fontSize: 12 }}
          />
        ) : (
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>{value || "—"}</div>
        )}
      </div>
      <button type="button" onClick={() => setEdit(e => !e)} style={{ ...btn("#CE93D8"), padding: "4px 8px" }} title="Изменить">
        ✏️
      </button>
    </div>
  );
}

export default function AdminCharactersPetsTab() {
  const [section, setSection] = useState<Section>("brawlers");
  const [activeId, setActiveId] = useState(BRAWLERS[0]?.id ?? "");
  const [draft, setDraft] = useState<CharacterBalanceOverrides>(() => loadCharacterBalanceOverrides());
  const [saved, setSaved] = useState<CharacterBalanceOverrides>(() => loadCharacterBalanceOverrides());
  const [modal, setModal] = useState<ModalKind>(null);
  const [status, setStatus] = useState("");
  const [importJson, setImportJson] = useState("");
  const [upgradeBulkPct, setUpgradeBulkPct] = useState(10);
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();
  const [, bump] = useState(0);

  const reload = useCallback(() => {
    const o = loadCharacterBalanceOverrides();
    setDraft(JSON.parse(JSON.stringify(o)));
    setSaved(JSON.parse(JSON.stringify(o)));
    bump(n => n + 1);
  }, []);

  useEffect(() => subscribeCharacterBalanceChanges(reload), [reload]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const brawler = useMemo(() => {
    const base = getEffectiveBrawler(activeId);
    const p = draft.brawlers?.[activeId];
    return base && p ? { ...base, ...p } : base;
  }, [activeId, draft]);

  const pet = useMemo(() => {
    if (section !== "pets") return undefined;
    const base = getEffectivePet(activeId);
    const p = draft.pets?.[activeId];
    if (!base) return undefined;
    if (!p) return base;
    const ep = p.effectPatch ?? (p as { effect?: typeof base.effect }).effect;
    return {
      ...base,
      ...p,
      effect: ep ? ({ ...base.effect, ...ep } as typeof base.effect) : base.effect,
    };
  }, [activeId, draft, section]);

  const patchBrawler = (patch: NonNullable<CharacterBalanceOverrides["brawlers"]>[string]) => {
    setDraft(d => ({
      ...d,
      brawlers: { ...d.brawlers, [activeId]: { ...(d.brawlers?.[activeId] ?? {}), ...patch } },
    }));
  };

  const patchPet = (patch: NonNullable<CharacterBalanceOverrides["pets"]>[string]) => {
    setDraft(d => ({
      ...d,
      pets: { ...d.pets, [activeId]: { ...(d.pets?.[activeId] ?? {}), ...patch } },
    }));
  };

  const patchEconomy = (patch: NonNullable<CharacterBalanceOverrides["economy"]>) => {
    setDraft(d => ({ ...d, economy: { ...d.economy, ...patch } }));
  };

  const upgradeCostsTable = useMemo(() => getUpgradeCostsTable(draft.economy), [draft.economy]);

  const patchLevelUpgradeCost = (level: number, field: "coins" | "powerPoints", value: number) => {
    const row = upgradeCostsTable[level];
    patchEconomy({
      upgradeCostsByLevel: {
        ...draft.economy?.upgradeCostsByLevel,
        [level]: { ...row, [field]: value },
      },
    });
  };

  const patchBrawlerStat = (key: (typeof BRAWLER_NUMERIC_KEYS)[number], newVal: number) => {
    if (!brawler) return;
    const oldVal = (draft.brawlers?.[activeId]?.[key] as number | undefined) ?? (brawler[key] as number);
    const textSync = syncBrawlerTextsOnStatChange(oldVal, newVal, {
      description: brawler.description,
      attackDesc: brawler.attackDesc,
      superDesc: brawler.superDesc,
    });
    patchBrawler({ [key]: newVal, ...textSync } as NonNullable<CharacterBalanceOverrides["brawlers"]>[string]);
  };

  const patchPetEffectField = (key: string, newVal: number) => {
    if (!pet) return;
    const oldVal = Number((pet.effect as Record<string, number>)[key]);
    const textSync = syncPetTextsOnEffectChange(oldVal, newVal, {
      description: pet.description,
      effectLabel: pet.effectLabel,
    });
    patchPet({
      effectPatch: { ...(draft.pets?.[activeId]?.effectPatch ?? {}), [key]: newVal } as Partial<typeof pet.effect>,
      ...textSync,
    });
  };

  const patchMechanic = (key: string, value: number) => {
    setDraft(d => ({
      ...d,
      brawlerMechanics: {
        ...d.brawlerMechanics,
        [activeId]: { ...(d.brawlerMechanics?.[activeId] ?? {}), [key]: value },
      },
    }));
  };

  const removeMechanicKey = (key: string) => {
    setDraft(d => {
      const m = { ...(d.brawlerMechanics?.[activeId] ?? {}) };
      delete m[key];
      return { ...d, brawlerMechanics: { ...d.brawlerMechanics, [activeId]: m } };
    });
  };

  const commitSave = () => {
    const r = commitAdminAction({
      domain: "character_balance_save",
      label: "Баланс персонажей и питомцев",
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

  const discard = () => {
    setDraft(JSON.parse(JSON.stringify(saved)));
    setStatus("Изменения отменены (не сохранённые)");
  };

  const stars = getEffectiveConstellation(activeId);
  const starCosts = getEffectiveStarCosts();
  const upgrade = getEffectiveUpgradeCost(5);
  const mechanics = draft.brawlerMechanics?.[activeId] ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn(section === "brawlers" ? "#FFD740" : "#888")} onClick={() => { setSection("brawlers"); setActiveId(BRAWLERS[0]?.id ?? ""); }}>⚔️ Бойцы</button>
        <button type="button" style={btn(section === "pets" ? "#FFD740" : "#888")} onClick={() => { setSection("pets"); setActiveId(PETS[0]?.id ?? ""); }}>🐾 Питомцы</button>
        <span style={{ flex: 1 }} />
        {isDirty && <span style={{ fontSize: 11, color: "#FFD740", fontWeight: 800 }}>● Не сохранено</span>}
        <button type="button" style={btn("#81C784")} disabled={!isDirty} onClick={commitSave}>💾 Сохранить</button>
        <button type="button" style={btn("#FF8A80")} disabled={!isDirty} onClick={discard}>↩ Отменить</button>
        <button type="button" style={btn("#B39DDB")} onClick={() => { resetCharacterBalanceOverrides(); reload(); setStatus("Сброшено к дефолту"); }}>🗑 Сброс</button>
      </div>

      <AdminScheduleControls schedule={schedule} onChange={setSchedule} />

      {status && <div style={{ fontSize: 11, color: "#FFD740", fontWeight: 700 }}>{status}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, minHeight: 420 }}>
        <div style={{ overflowY: "auto", maxHeight: 520, display: "flex", flexDirection: "column", gap: 4 }}>
          {(section === "brawlers" ? BRAWLERS : PETS).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                border: activeId === item.id ? "1px solid #FFD740" : "1px solid rgba(255,255,255,0.1)",
                background: activeId === item.id ? "rgba(255,215,64,0.12)" : "rgba(0,0,0,0.35)",
                color: "#fff", fontWeight: 800, fontSize: 12,
              }}
            >
              {"name" in item ? item.name : item.id}
            </button>
          ))}
        </div>

        <div className="ui-glass" style={{ padding: 14, overflowY: "auto", maxHeight: 520 }}>
          {section === "brawlers" && brawler && (
            <>
              <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                <div style={{ width: 120, height: 120 }}><BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={110} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{brawler.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{BRAWLER_RARITY_LABEL[brawler.rarity]} · {brawler.role}</div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>Ур.5: HP {getScaledStats(brawler, 5).hp} · урон {getScaledStats(brawler, 5).attackDamage}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button type="button" style={btn("#40C4FF")} onClick={() => setModal("resources")}>💰 Поменять ресурсы</button>
                <button type="button" style={btn("#FF80AB")} onClick={() => setModal("balance")}>⚖️ Поменять баланс</button>
                <button type="button" style={btn("#FFD740")} onClick={() => setModal("stars")}>⭐ Звёзды</button>
              </div>
              <EditableRow label="Имя" value={brawler.name} onChange={v => patchBrawler({ name: v })} />
              <EditableRow label="Описание" value={brawler.description} onChange={v => patchBrawler({ description: v })} />
              <EditableRow label="Лор" value={draft.brawlers?.[activeId]?.lore ?? getEffectiveBrawlerLore(activeId)} onChange={v => patchBrawler({ lore: v })} />
              <EditableRow label="Атака" value={brawler.attackName} onChange={v => patchBrawler({ attackName: v })} />
              <EditableRow label="Описание атаки" value={brawler.attackDesc} onChange={v => patchBrawler({ attackDesc: v })} />
              <EditableRow label="Супер" value={brawler.superName} onChange={v => patchBrawler({ superName: v })} />
              <EditableRow label="Описание супера" value={brawler.superDesc} onChange={v => patchBrawler({ superDesc: v })} />
              <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                Прокачка 5→6: {upgrade.coins}🪙 + {upgrade.powerPoints}⚡ (настраивается по каждому уровню)
              </div>
            </>
          )}

          {section === "pets" && pet && (
            <>
              <div style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "center" }}>
                <PetSvg pet={pet} size={90} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{pet.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{PET_RARITY_LABEL[pet.rarity]}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>{pet.effectLabel}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button type="button" style={btn("#40C4FF")} onClick={() => setModal("resources")}>💰 Цена / ресурсы</button>
                <button type="button" style={btn("#FF80AB")} onClick={() => setModal("balance")}>⚖️ Эффект питомца</button>
              </div>
              <EditableRow label="Имя" value={pet.name} onChange={v => patchPet({ name: v })} />
              <EditableRow label="Описание" value={pet.description} onChange={v => patchPet({ description: v })} />
              <EditableRow label="Эффект (текст)" value={pet.effectLabel} onChange={v => patchPet({ effectLabel: v })} />
            </>
          )}
        </div>
      </div>

      <div className="ui-glass" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6 }}>Импорт / экспорт JSON</div>
        <textarea className="ui-input" rows={3} value={importJson} onChange={e => setImportJson(e.target.value)} placeholder="Вставьте JSON оверрайдов..." style={{ width: "100%", fontSize: 11, fontFamily: "monospace" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn("#81C784")} onClick={() => { try { importCharacterBalanceJson(importJson, "merge"); reload(); setStatus("Импорт (merge)"); } catch { setStatus("Ошибка JSON"); } }}>Импорт merge</button>
          <button type="button" style={btn("#FF8A80")} onClick={() => { try { importCharacterBalanceJson(importJson, "replace"); reload(); setStatus("Импорт replace"); } catch { setStatus("Ошибка JSON"); } }}>Импорт replace</button>
          <button type="button" style={btn("#B39DDB")} onClick={() => { navigator.clipboard?.writeText(exportCharacterBalanceJson()); setStatus("JSON скопирован"); }}>Копировать экспорт</button>
        </div>
      </div>

      {modal === "resources" && (
        <Modal title="Ресурсы и цены" wide onClose={() => setModal(null)}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, color: "#40C4FF" }}>Стоимость прокачки по уровням (для ВСЕХ бойцов)</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
            Изменения здесь глобальные — на любого персонажа, не только на выбранного. Для цен по редкости см. вкладку «Стоимость».
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11 }}>Массово ±% ко всем уровням:</span>
            <input type="number" value={upgradeBulkPct} onChange={e => setUpgradeBulkPct(Number(e.target.value))} style={{ width: 56, padding: 4, borderRadius: 6 }} />
            <button
              type="button"
              style={adminBtn("#B39DDB")}
              onClick={() => {
                const table = { ...draft.economy?.upgradeCostsByLevel };
                for (let lv = 1; lv < MAX_BRAWLER_LEVEL; lv++) {
                  const row = upgradeCostsTable[lv];
                  table[lv] = {
                    coins: applyPercentDelta(row.coins, upgradeBulkPct),
                    powerPoints: applyPercentDelta(row.powerPoints, upgradeBulkPct),
                  };
                }
                patchEconomy({ upgradeCostsByLevel: table });
              }}
            >
              Применить
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 14 }}>
            <thead>
              <tr style={{ color: "rgba(255,255,255,0.55)", textAlign: "left" }}>
                <th style={{ padding: "4px 6px" }}>Переход</th>
                <th style={{ padding: "4px 6px" }}>Монеты</th>
                <th style={{ padding: "4px 6px" }}>Очки силы</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: MAX_BRAWLER_LEVEL - 1 }, (_, i) => i + 1).map(lv => (
                <tr key={lv} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <td style={{ padding: "6px", fontWeight: 800 }}>{lv} → {lv + 1}</td>
                  <td style={{ padding: "4px" }}>
                    <input
                      type="number"
                      style={numInput()}
                      value={upgradeCostsTable[lv].coins}
                      onChange={e => patchLevelUpgradeCost(lv, "coins", Number(e.target.value))}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      type="number"
                      style={numInput()}
                      value={upgradeCostsTable[lv].powerPoints}
                      onChange={e => patchLevelUpgradeCost(lv, "powerPoints", Number(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <AdminPercentField label="Рост HP за уровень (%)" value={(draft.economy?.scaleHpPerLevel ?? 0.05) * 100} onChange={v => patchEconomy({ scaleHpPerLevel: v / 100 })} />
            <AdminPercentField label="Рост урона за уровень (%)" value={(draft.economy?.scaleDmgPerLevel ?? 0.03) * 100} onChange={v => patchEconomy({ scaleDmgPerLevel: v / 100 })} />
            <AdminPercentField label="Звезда (кристаллы)" value={draft.economy?.starCostGems ?? starCosts.singleGems} onChange={v => patchEconomy({ starCostGems: v })} />
            <AdminPercentField label="Пак 3 звёзд (кристаллы)" value={draft.economy?.starPack3Gems ?? starCosts.pack3Gems} onChange={v => patchEconomy({ starPack3Gems: v })} />
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Сохраните изменения, чтобы применить в игре.</div>
        </Modal>
      )}

      {modal === "balance" && section === "brawlers" && brawler && (
        <Modal title={`Баланс: ${brawler.name}`} wide onClose={() => setModal(null)}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
            Числа в описании, атаке и супере обновляются автоматически при изменении характеристик.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {BRAWLER_NUMERIC_KEYS.map(k => (
              <AdminPercentField
                key={k}
                label={BRAWLER_STAT_LABELS_RU[k]}
                value={(draft.brawlers?.[activeId]?.[k] as number | undefined) ?? (brawler[k] as number)}
                onChange={v => patchBrawlerStat(k, v)}
              />
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 900, color: "#CE93D8" }}>Доп. параметры механик</div>
          {Object.entries(mechanics).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input className="ui-input" value={k} readOnly style={{ flex: 1, fontSize: 11 }} />
              <input className="ui-input" type="number" value={v} onChange={e => patchMechanic(k, Number(e.target.value))} style={{ width: 100 }} />
              <button type="button" style={btn("#FF8A80")} onClick={() => removeMechanicKey(k)}>✕</button>
            </div>
          ))}
          <AddMechanicRow onAdd={(k, v) => patchMechanic(k, v)} />
        </Modal>
      )}

      {modal === "balance" && section === "pets" && pet && (
        <Modal title={`Эффект: ${pet.name}`} onClose={() => setModal(null)}>
          <div style={{ fontSize: 11, marginBottom: 8, color: "rgba(255,255,255,0.55)" }}>
            Тип: {PET_EFFECT_KIND_RU[pet.effect.kind] ?? pet.effect.kind}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
            Числа в тексте эффекта и описании обновляются автоматически.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {petEffectFieldKeys(pet.effect).map(k => (
              <AdminPercentField
                key={k}
                label={PET_EFFECT_LABELS_RU[k] ?? k}
                value={Number((pet.effect as Record<string, number>)[k])}
                onChange={v => patchPetEffectField(k, v)}
              />
            ))}
          </div>
        </Modal>
      )}

      {modal === "stars" && (
        <Modal title={`Звёзды: ${brawler?.name ?? activeId}`} onClose={() => setModal(null)}>
          {(draft.constellations?.[activeId] ?? stars).map((s, i) => (
            <div key={s.index} style={{ marginBottom: 10, padding: 8, background: "rgba(0,0,0,0.35)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 4 }}>★ {s.index}</div>
              <EditableRow
                label="Название"
                value={s.name}
                onChange={v => {
                  const list = [...(draft.constellations?.[activeId] ?? stars)];
                  list[i] = { ...list[i], name: v };
                  setDraft(d => ({ ...d, constellations: { ...d.constellations, [activeId]: list } }));
                }}
              />
              <EditableRow
                label="Эффект"
                value={s.effect}
                onChange={v => {
                  const list = [...(draft.constellations?.[activeId] ?? stars)];
                  list[i] = { ...list[i], effect: v };
                  setDraft(d => ({ ...d, constellations: { ...d.constellations, [activeId]: list } }));
                }}
              />
            </div>
          ))}
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
            Текст звёзд меняется сразу. Игровые бонусы в коде механик могут отличаться от описания.
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddMechanicRow({ onAdd }: { onAdd: (k: string, v: number) => void }) {
  const [k, setK] = useState("");
  const [v, setV] = useState(0);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input className="ui-input" placeholder="ключ (shadow_hp)" value={k} onChange={e => setK(e.target.value)} style={{ flex: 1 }} />
      <input className="ui-input" type="number" value={v} onChange={e => setV(Number(e.target.value))} style={{ width: 90 }} />
      <button type="button" style={btn("#81C784")} onClick={() => { if (k.trim()) onAdd(k.trim(), v); }}>+</button>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div className="ui-glass" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: wide ? 680 : 560, maxHeight: "85vh", overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
          <button type="button" style={btn("#888")} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
