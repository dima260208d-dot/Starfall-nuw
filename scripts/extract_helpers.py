# -*- coding: utf-8 -*-
import re
from pathlib import Path

s = Path("scripts/append_pin_modal.py").read_text(encoding="utf-8")
m = re.search(r"helpers_REMOVED = '''(.*?)'''", s, re.DOTALL)
if not m:
    raise SystemExit("helpers block not found")
h = m.group(1)

bad = "motionPinModalHeader"
locked_fix = """      {locked ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 13 }}>🔒</span>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 800, color: "#80DEEA",
          }}>
            <GemIcon size={11} /> {cost}
          </motionPinModalHeader
          <motionPinModalHeader
            КУПИТЬ
          </motionPinModalHeader
        </motionPinModalHeader
      ) : isEquipped ? ("""

# build locked_fix without bad word
dv = "div"
sp = "span"
locked_fix = (
    "      {locked ? (\n"
    f"        <{dv} style={{{{ display: \"flex\", flexDirection: \"column\", alignItems: \"center\", gap: 2 }}}}>\n"
    f'          <{sp} style={{{{ fontSize: 13 }}}}>🔒</{sp}>\n'
    f"          <{dv} style={{{{ display: \"inline-flex\", alignItems: \"center\", gap: 3, fontSize: 11, fontWeight: 800, color: \"#80DEEA\" }}}}>\n"
    "            <GemIcon size={11} /> {cost}\n"
    f"          </{dv}>\n"
    f"          <{dv} style={{{{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, color: \"rgba(255,255,255,0.5)\" }}}}>\n"
    "            КУПИТЬ\n"
    f"          </{dv}>\n"
    f"        </{dv}>\n"
    "      ) : isEquipped ? ("
)

pat = r"\{locked \? \(\s*<" + bad + r"\s*\)"
h = re.sub(pat, locked_fix, h, count=1)
h = h.replace("</" + bad, "</div>")
h = h.replace(">" + bad, ">")  # noop if none
h = h.replace(bad, "")

pin = Path("src/components/PinSelectModal.tsx")
body = pin.read_text(encoding="utf-8")
if "function EquipSlotRow" not in body:
    pin.write_text(body.rstrip() + "\n" + h, encoding="utf-8")
    print("helpers appended")
else:
    print("helpers already present")
