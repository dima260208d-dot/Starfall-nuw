# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("src/components/ChestOpenModal.tsx")
s = p.read_text(encoding="utf-8")

# Fix broken closing tags missing >
import re
s = re.sub(r"</(div)(\s*\n)", r"</\1>\2", s)

# phaseFor pin
s = s.replace(
    'r?.type === "brawler" ? "brawler" : r?.type === "pet" ? "pet" : "dropping"',
    'r?.type === "brawler" ? "brawler" : r?.type === "pet" ? "pet" : r?.type === "pin" ? "pin" : "dropping"',
)
s = s.replace(
    'nextRoll?.type === "brawler" || nextRoll?.type === "pet"',
    'nextRoll?.type === "brawler" || nextRoll?.type === "pet" || nextRoll?.type === "pin"',
)
s = s.replace(
    'if (phase === "brawler" || phase === "pet") return;',
    'if (phase === "brawler" || phase === "pet" || phase === "pin") return;',
)
s = s.replace(
    'roll && roll.type !== "brawler" && roll.type !== "pet"',
    'roll && roll.type !== "brawler" && roll.type !== "pet" && roll.type !== "pin"',
)
if "isPinDrop" not in s:
    s = s.replace(
        'const isPetDrop      = phase === "pet"      && roll?.type === "pet";',
        'const isPetDrop      = phase === "pet"      && roll?.type === "pet";\n  const isPinDrop      = phase === "pin"      && roll?.type === "pin";',
    )
if "isPinDrop && roll.pinId" not in s:
    pin_block = """
      {isPinDrop && roll.pinId && (
        <PinRevealModal pinId={roll.pinId} onDone={() => advance()} />
      )}

"""
    s = s.replace("{/* ── Collecting overlay ── */}", pin_block + "      {/* ── Collecting overlay ── */}")

p.write_text(s, encoding="utf-8")
print("fixed")
