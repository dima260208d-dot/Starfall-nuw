const BASELINE_KEY = "dev_code_baseline_v1";
const AUDIT_KEY = "dev_code_audit_v1";
const LS_SNAPSHOT_KEY = "dev_ls_snapshot_v1";
const MAX_AUDIT = 200;

export interface FileFingerprint {
  path: string;
  hash: string;
  size: number;
  lines: number;
  chars: number;
}

export interface FileChange {
  path: string;
  kind: "added" | "removed" | "modified" | "unchanged";
  oldHash?: string;
  newHash?: string;
  sizeDelta: number;
  lineDelta: number;
  charDelta: number;
}

export interface IntegrityAuditEntry {
  id: string;
  ts: number;
  filesScanned: number;
  filesChanged: number;
  filesAdded: number;
  filesRemoved: number;
  totalChars: number;
  lsKeysChanged: number;
  summary: string;
  changes: FileChange[];
}

export interface LocalStorageEntry {
  key: string;
  size: number;
  preview: string;
}

function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota */ }
}

/** Lazy-load all src modules as raw text for fingerprinting. */
async function loadSourceFingerprints(): Promise<FileFingerprint[]> {
  const glob = import.meta.glob(
    ["../../**/*.{ts,tsx,css,json}", "!../../**/*.d.ts"],
    { query: "?raw", import: "default" },
  );
  const entries: FileFingerprint[] = [];
  for (const [path, loader] of Object.entries(glob)) {
    try {
      const content = (await loader()) as string;
      const lines = content.split("\n").length;
      entries.push({
        path: path.replace(/^\.\.\//, "src/"),
        hash: fnv1a(content),
        size: new Blob([content]).size,
        lines,
        chars: content.length,
      });
    } catch { /* skip unreadable */ }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function snapshotLocalStorage(): LocalStorageEntry[] {
  const out: LocalStorageEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const val = localStorage.getItem(key) ?? "";
    out.push({
      key,
      size: val.length,
      preview: val.slice(0, 48),
    });
  }
  return out.sort((a, b) => b.size - a.size);
}

function diffFingerprints(
  prev: FileFingerprint[],
  next: FileFingerprint[],
): FileChange[] {
  const prevMap = new Map(prev.map(f => [f.path, f]));
  const nextMap = new Map(next.map(f => [f.path, f]));
  const changes: FileChange[] = [];

  for (const f of next) {
    const old = prevMap.get(f.path);
    if (!old) {
      changes.push({
        path: f.path,
        kind: "added",
        newHash: f.hash,
        sizeDelta: f.size,
        lineDelta: f.lines,
        charDelta: f.chars,
      });
    } else if (old.hash !== f.hash) {
      changes.push({
        path: f.path,
        kind: "modified",
        oldHash: old.hash,
        newHash: f.hash,
        sizeDelta: f.size - old.size,
        lineDelta: f.lines - old.lines,
        charDelta: f.chars - old.chars,
      });
    } else {
      changes.push({
        path: f.path,
        kind: "unchanged",
        oldHash: old.hash,
        newHash: f.hash,
        sizeDelta: 0,
        lineDelta: 0,
        charDelta: 0,
      });
    }
  }

  for (const f of prev) {
    if (!nextMap.has(f.path)) {
      changes.push({
        path: f.path,
        kind: "removed",
        oldHash: f.hash,
        sizeDelta: -f.size,
        lineDelta: -f.lines,
        charDelta: -f.chars,
      });
    }
  }

  return changes;
}

export interface IntegrityReport {
  scannedAt: number;
  files: FileFingerprint[];
  changes: FileChange[];
  significantChanges: FileChange[];
  localStorage: LocalStorageEntry[];
  lsDiff: { added: string[]; removed: string[]; sizeChanged: { key: string; delta: number }[] };
  auditLog: IntegrityAuditEntry[];
  totals: {
    files: number;
    chars: number;
    lines: number;
    lsKeys: number;
    lsBytes: number;
  };
}

export async function runIntegrityScan(opts?: { resetBaseline?: boolean }): Promise<IntegrityReport> {
  const files = await loadSourceFingerprints();
  const baseline = opts?.resetBaseline ? [] : loadJson<FileFingerprint[]>(BASELINE_KEY, []);
  const changes = baseline.length ? diffFingerprints(baseline, files) : files.map(f => ({
    path: f.path,
    kind: "added" as const,
    newHash: f.hash,
    sizeDelta: f.size,
    lineDelta: f.lines,
    charDelta: f.chars,
  }));

  const significantChanges = changes.filter(c => c.kind !== "unchanged");
  const lsNow = snapshotLocalStorage();
  const lsPrev = loadJson<LocalStorageEntry[]>(LS_SNAPSHOT_KEY, []);
  const lsPrevMap = new Map(lsPrev.map(e => [e.key, e.size]));
  const lsNowMap = new Map(lsNow.map(e => [e.key, e.size]));
  const lsDiff = {
    added: lsNow.filter(e => !lsPrevMap.has(e.key)).map(e => e.key),
    removed: lsPrev.filter(e => !lsNowMap.has(e.key)).map(e => e.key),
    sizeChanged: lsNow
      .filter(e => lsPrevMap.has(e.key) && lsPrevMap.get(e.key) !== e.size)
      .map(e => ({ key: e.key, delta: e.size - (lsPrevMap.get(e.key) ?? 0) })),
  };

  const auditLog = loadJson<IntegrityAuditEntry[]>(AUDIT_KEY, []);
  if (baseline.length > 0 && significantChanges.length > 0) {
    const entry: IntegrityAuditEntry = {
      id: `audit_${Date.now()}`,
      ts: Date.now(),
      filesScanned: files.length,
      filesChanged: significantChanges.filter(c => c.kind === "modified").length,
      filesAdded: significantChanges.filter(c => c.kind === "added").length,
      filesRemoved: significantChanges.filter(c => c.kind === "removed").length,
      totalChars: files.reduce((s, f) => s + f.chars, 0),
      lsKeysChanged: lsDiff.added.length + lsDiff.removed.length + lsDiff.sizeChanged.length,
      summary: `${significantChanges.length} изменений в исходниках, ${lsDiff.added.length} новых ключей LS`,
      changes: significantChanges.slice(0, 60),
    };
    auditLog.unshift(entry);
    saveJson(AUDIT_KEY, auditLog.slice(0, MAX_AUDIT));
  }

  saveJson(BASELINE_KEY, files);
  saveJson(LS_SNAPSHOT_KEY, lsNow);

  return {
    scannedAt: Date.now(),
    files,
    changes,
    significantChanges,
    localStorage: lsNow,
    lsDiff,
    auditLog: auditLog.slice(0, MAX_AUDIT),
    totals: {
      files: files.length,
      chars: files.reduce((s, f) => s + f.chars, 0),
      lines: files.reduce((s, f) => s + f.lines, 0),
      lsKeys: lsNow.length,
      lsBytes: lsNow.reduce((s, e) => s + e.size, 0),
    },
  };
}

export function getIntegrityAuditLog(): IntegrityAuditEntry[] {
  return loadJson<IntegrityAuditEntry[]>(AUDIT_KEY, []);
}
