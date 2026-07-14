import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ADMIN_SETTINGS_CATEGORIES,
  ADMIN_SETTINGS_MANIFEST,
  loadAdminSettings,
  saveAdminSettingsLocal,
  type AdminSettingDef,
} from "../../data/adminSettingsManifest";
import { saveAdminSettingsToServer, fetchAdminSettingsFromServer } from "../../utils/adminServerApi";
import { applyAdminUiSettings, notifyAdminSettingsChanged } from "../../utils/adminSettingsRuntime";
import { checkAdminBiometric, requestAdminBiometricPermission } from "../../utils/adminBiometric";
import { isLiveOpsAdminSession } from "../../lib/configServerPublish";

export default function AdminSettingsTab() {
  const [values, setValues] = useState(loadAdminSettings);
  const [saved, setSaved] = useState(loadAdminSettings);
  const [category, setCategory] = useState(ADMIN_SETTINGS_CATEGORIES[0]?.id ?? "security");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [bioStatus, setBioStatus] = useState("");

  useEffect(() => {
    applyAdminUiSettings();
    if (isLiveOpsAdminSession()) {
      void fetchAdminSettingsFromServer().then((remote) => {
        if (!remote) return;
        const merged = loadAdminSettings();
        for (const def of ADMIN_SETTINGS_MANIFEST) {
          const v = remote[def.id];
          if (v === undefined) continue;
          if (def.type === "bool" && typeof v === "boolean") merged[def.id] = v;
          else if (def.type === "number" && typeof v === "number") merged[def.id] = v;
          else if (def.type === "select" && typeof v === "string") merged[def.id] = v;
        }
        saveAdminSettingsLocal(merged);
        setValues(merged);
        setSaved(merged);
        notifyAdminSettingsChanged();
      });
    }
    void requestAdminBiometricPermission().then(async () => {
      const s = await checkAdminBiometric();
      if (s.available) {
        setBioStatus(`Биометрия: ${s.biometryType === "face" ? "лицо" : s.biometryType === "fingerprint" ? "отпечаток" : s.biometryType}`);
      } else {
        setBioStatus(s.reason === "web" ? "Биометрия доступна только в APK" : "Биометрия недоступна на устройстве");
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return ADMIN_SETTINGS_MANIFEST.filter((d) => {
      if (d.category !== category) return false;
      if (!q) return true;
      return d.label.toLowerCase().includes(q) || d.id.toLowerCase().includes(q);
    });
  }, [category, filter]);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  function setValue(id: string, v: boolean | number | string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function saveAll() {
    saveAdminSettingsLocal(values);
    notifyAdminSettingsChanged();
    setSaved({ ...values });
    if (isLiveOpsAdminSession()) {
      const r = await saveAdminSettingsToServer(values);
      setStatus(r.ok ? "✓ " + r.message : "✗ " + r.message);
    } else {
      setStatus("✓ Сохранено локально");
    }
    setTimeout(() => setStatus(""), 3500);
  }

  function resetCategory() {
    const next = { ...values };
    for (const d of ADMIN_SETTINGS_MANIFEST.filter((x) => x.category === category)) {
      next[d.id] = d.default;
    }
    setValues(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(79,156,255,0.08)", border: "1px solid rgba(79,156,255,0.25)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#4f9cff" }}>⚙️ Настройки админ-панели</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, lineHeight: 1.45 }}>
          {ADMIN_SETTINGS_MANIFEST.length} параметров в {ADMIN_SETTINGS_CATEGORIES.length} категориях.
          Синхронизация с config-server (домен adminSettings).
        </div>
        {bioStatus && (
          <div style={{ fontSize: 11, color: "#3ad29f", marginTop: 8, fontWeight: 700 }}>{bioStatus}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ADMIN_SETTINGS_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            style={catBtn(category === c.id)}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <input
        className="ui-input"
        placeholder="Поиск настройки…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ maxWidth: 360 }}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 10,
      }}>
        {filtered.map((def) => (
          <SettingRow key={def.id} def={def} value={values[def.id]} onChange={(v) => setValue(def.id, v)} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => void saveAll()} style={primaryBtn()} disabled={!dirty}>
          💾 Сохранить на сервер
        </button>
        <button type="button" onClick={resetCategory} style={ghostBtn()}>Сбросить категорию</button>
        {status && <span style={{ fontSize: 12, fontWeight: 700, color: status.startsWith("✓") ? "#3ad29f" : "#ff6b6b" }}>{status}</span>}
        {dirty && <span style={{ fontSize: 11, color: "#FFD54F" }}>Есть несохранённые изменения</span>}
      </div>
    </div>
  );
}

function SettingRow({
  def,
  value,
  onChange,
}: {
  def: AdminSettingDef;
  value: boolean | number | string | undefined;
  onChange: (v: boolean | number | string) => void;
}) {
  const v = value ?? def.default;
  return (
    <label style={{
      display: "flex", flexDirection: "column", gap: 6, padding: 12,
      borderRadius: 10, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#e8eef7" }}>{def.label}</span>
      {def.hint && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.35 }}>{def.hint}</span>}
      {def.type === "bool" && (
        <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange(e.target.checked)} />
      )}
      {def.type === "number" && (
        <input
          type="number"
          className="ui-input"
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          value={Number(v)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
      {def.type === "select" && def.options && (
        <select
          className="ui-input"
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        >
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </label>
  );
}

function catBtn(active: boolean): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: active ? "1px solid #4f9cff" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(79,156,255,0.18)" : "rgba(0,0,0,0.3)",
    color: active ? "#4f9cff" : "#8aa0bd",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function primaryBtn(): CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#4f9cff",
    color: "#04101f",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

function ghostBtn(): CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "#8aa0bd",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  };
}
