# -*- coding: utf-8 -*-
"""Build scripts/game-pin-manifest.json (UTF-8 safe on Windows)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def parse_collectible(ts: str):
    removed = set(re.findall(r'"([^"]+)"', re.search(
        r"REMOVED_PIN_IDS\s*=\s*new Set\(\[([\s\S]*?)\]\)", ts
    ).group(1)))
    pins = []
    for m in re.finditer(
        r'pin\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"(?:,\s*(true|false))?(?:,\s*"(png|svg)")?\)',
        ts,
    ):
        pid, label, emoji, rarity, golden, _ext = m.groups()
        if pid in removed:
            continue
        pins.append({
            "id": pid,
            "label": label,
            "emoji": emoji,
            "rarity": rarity,
            "goldenFrame": golden == "true",
            "dir": "game",
            "pool": "premium" if pid.startswith("g2_") else "common",
        })
    return pins


def parse_universal(ts: str):
    pins = []
    for m in re.finditer(
        r'\{\s*id:\s*"([^"]+)",\s*kind:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*emoji:\s*"([^"]+)"',
        ts,
    ):
        pins.append({
            "id": m.group(1),
            "kind": m.group(2),
            "label": m.group(3),
            "emoji": m.group(4),
            "dir": "general",
            "pool": "universal",
        })
    return pins


def main():
    c = (ROOT / "src/entities/CollectiblePinData.ts").read_text(encoding="utf-8")
    p = (ROOT / "src/entities/PinData.ts").read_text(encoding="utf-8")
    manifest = parse_collectible(c) + parse_universal(p)
    out = ROOT / "scripts/game-pin-manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(manifest)} pins -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
