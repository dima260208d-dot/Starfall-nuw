# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("src/components/PinIcon.tsx")
s = p.read_text(encoding="utf-8")
bad = "motionPinModalHeader"
if bad in s:
    s = s.replace(bad, "")
# fix broken special block
broken = """      {special && !golden && (
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          borderRadius: "24%",
          padding: ringThickness,
          background: special
            ? "transparent"
            : `linear-gradient(135deg, ${rim} 0%, ${rimSecondary} 100%)`,
"""
fixed = """      {special && !golden && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -ringThickness,
            borderRadius: "24%",
            background:
              "conic-gradient(from 0deg, #FF1744, #FFEA00, #00E676, #00B0FF, #D500F9, #FF1744)",
            filter: "blur(1px)",
            animation: animated ? "pinSpecialSpin 6s linear infinite" : undefined,
            pointerEvents: "none",
          }}
        />
      )}

      <motionPinModalHeader
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          borderRadius: "24%",
          padding: ringThickness,
          background: special
            ? "transparent"
            : `linear-gradient(135deg, ${rim} 0%, ${rimSecondary} 100%)`,
"""
fixed = fixed.replace("<motionPinModalHeader\n", "<div\n")
s = s.replace(broken, fixed)
p.write_text(s, encoding="utf-8")
print("fixed")
