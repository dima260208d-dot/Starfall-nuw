/** Wire payload — identical map bytes for server authoritative sim. */
export type BattleMapPayload = {
  name: string;
  editorMode: string;
  cells: number[];
  overlays: number[];
  rotations?: number[];
};

/** FNV-1a hash — room gate so every client shares the same map geometry. */
export function computeBattleMapHash(map: BattleMapPayload): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  for (let i = 0; i < map.editorMode.length; i++) {
    h ^= map.editorMode.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  for (const arr of [map.cells, map.overlays, map.rotations ?? []]) {
    mix(arr.length);
    for (let i = 0; i < arr.length; i++) mix(arr[i]!);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
