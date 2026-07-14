# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("src/components/ChestOpenModal.tsx")
s = p.read_text(encoding="utf-8")

start = s.find("        {pinId && (")
end = s.find("function SummaryCard(")
if start < 0 or end < 0:
    raise SystemExit("markers not found")

fixed = '''        {pinId && (
          <motionPinModalHeader
'''

fixed = '''        {pinId && (
          <div style={{
            background: "rgba(0,0,0,0.55)",
            border: "2px solid #CE93D8",
            borderRadius: 16, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 0 32px rgba(206,147,216,0.45)",
          }}>
            <PinIcon pinId={pinId} size={64} glow animated />
            <div>
              <div style={{ fontSize: 9, color: "#CE93D8", fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>💬 НОВЫЙ ПИН</div>
              {pinDef && (
                <div style={{ fontSize: 18, fontWeight: 900, color: "#CE93D8" }}>{pinDef.label}</div>
              )}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 8,
          background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
          border: "none", borderRadius: 16, padding: "14px 56px",
          color: "white", fontWeight: 900, fontSize: 16, letterSpacing: 4,
          cursor: "pointer", boxShadow: `0 8px 40px ${def.color}88`,
          textTransform: "uppercase", animation: "floatUp 2s ease-in-out infinite",
        }}
      >
        ОТЛИЧНО
      </button>
    </div>
  );
}

'''

s = s[:start] + fixed + s[end:]
p.write_text(s, encoding="utf-8")
print("summary fixed")
