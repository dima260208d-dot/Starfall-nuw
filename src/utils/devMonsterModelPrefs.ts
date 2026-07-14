const STORAGE_KEY = "dev_disabled_monster_models_v1";

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

export function getDisabledDevMonsterModelIds(): readonly string[] {
  return readIds();
}

export function isDevMonsterModelDisabled(id: string): boolean {
  return readIds().includes(id);
}

export function disableDevMonsterModel(id: string): void {
  const ids = readIds();
  if (!ids.includes(id)) {
    writeIds([...ids, id]);
    syncDisabledMonsterModelsIfAdmin();
  }
}

export function enableDevMonsterModel(id: string): void {
  writeIds(readIds().filter(x => x !== id));
  syncDisabledMonsterModelsIfAdmin();
}

function syncDisabledMonsterModelsIfAdmin(): void {
  try {
    void import("./liveOpsSync").then(m => m.syncDisabledMonsterModelsToServer());
  } catch { /* ignore */ }
}

export function toggleDevMonsterModelDisabled(id: string): boolean {
  if (isDevMonsterModelDisabled(id)) {
    enableDevMonsterModel(id);
    return false;
  }
  disableDevMonsterModel(id);
  return true;
}
