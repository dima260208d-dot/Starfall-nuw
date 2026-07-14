# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("src/components/PinSelectModal.tsx")
text = path.read_text(encoding="utf-8")
if "function EquipSlotRow" in text:
    print("already complete")
    raise SystemExit(0)

d = "div"
tail = "\n".join([
    f'          <{d} style={{{{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}}}',
    f"            <{d}>",
    f'              <{d} style={{{{ fontSize: 10, letterSpacing: 2, fontWeight: 800, color: "#FFD740", marginBottom: 8 }}}}',
    "                ПИНЫ ПЕРСОНАЖА",
    f"              </{d}>",
    f'              <{d} style={{{{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}}}',
    "                {brawlerGallery.map(g => (",
    "                  <GalleryPinCard",
    "                    key={g.pinId}",
    "                    pinId={g.pinId}",
    "                    label={g.label}",
    "                    isOwned={owned.has(g.pinId)}",
    "                    isEquipped={equipped.includes(g.pinId)}",
    "                    canUse={slotAcceptsPin(activeSlot, g.pinId)}",
    "                    onSelect={() => handleGallerySelect(g.pinId)}",
    "                  />",
    "                ))}",
    f"              </{d}>",
    f"            </{d}>",
    f"            <{d}>",
    f'              <{d} style={{{{ fontSize: 10, letterSpacing: 2, fontWeight: 800, color: "#80DEEA", marginBottom: 8 }}}}',
    "                ОБЩИЕ ПИНЫ",
    f"              </{d}>",
    f'              <{d} style={{{{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}}}',
    "                {UNIVERSAL_PINS.map(u => (",
    "                  <GalleryPinCard",
    "                    key={u.id}",
    "                    pinId={u.id}",
    "                    label={u.label}",
    "                    isOwned={owned.has(u.id)}",
    "                    isEquipped={equipped.includes(u.id)}",
    "                    canUse={slotAcceptsPin(activeSlot, u.id)}",
    "                    onSelect={() => handleGallerySelect(u.id)}",
    "                  />",
    "                ))}",
    f"              </{d}>",
    f"            </{d}>",
    f"          </{d}>",
    f"        </{d}>",
    "",
    f'        <{d} style={{{{',
    '          padding: "10px 16px",',
    '          borderTop: "1px solid rgba(255,255,255,0.10)",',
    '          background: "rgba(0,0,0,0.40)",',
    '          display: "flex", alignItems: "center", justifyContent: "space-between",',
    "          minHeight: 36,",
    "          gap: 8,",
    '          flexWrap: "wrap",',
    f"        }}}}",
    "        >",
    '          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>',
    '            Куплено: {[...owned].filter(id => id.startsWith("pin:")).length} пинов персонажей',
    "          </div>",
    '          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#80DEEA", fontWeight: 800 }}>',
    "            <GemIcon size={14} /> {profile.gems}",
    "          </div>",
    "          {msg && (",
    '            <div style={{',
    "              fontSize: 12, fontWeight: 800,",
    '              color: msg.tone === "err" ? "#FF7070" : "#76FF03",',
    "            }}>{msg.text}</div>",
    "          )}",
    f"        </{d}>",
    f"      </{d}>",
    f"    </{d}>",
    "  );",
    "}",
    "",
])

path.write_text(text.rstrip() + "\n" + tail, encoding="utf-8")
print("appended tail", len(tail))
raise SystemExit(0)

helpers_REMOVED = '''
function EquipSlotRow({
  title, slots, slotOffset, activeSlot, onSlotClick,
}: {
  title: string;
  slots: string[];
  slotOffset: number;
  activeSlot: number;
  onSlotClick: (slot: number) => void;
}) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)",
        marginBottom: 8, textAlign: "center",
      }}>{title}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {slots.map((pinId, i) => {
          const slot = slotOffset + i;
          const isActive = slot === activeSlot;
          return (
            <button
              key={slot}
              onClick={() => onSlotClick(slot)}
              title={pinId ? "Нажмите ещё раз, чтобы очистить" : "Выберите пин снизу"}
              style={{
                position: "relative",
                background: "transparent",
                border: "none",
                padding: 4,
                borderRadius: 999,
                cursor: "pointer",
                outline: isActive ? "3px solid #FFD740" : "3px solid transparent",
              }}
            >
              {pinId ? (
                <PinIcon pinId={pinId} size={58} glow={isActive} animated />
              ) : (
                <EmptySlot size={58} active={isActive} />
              )}
              <span style={{
                position: "absolute", top: -2, left: -2,
                background: isActive ? "#FFD740" : "rgba(255,255,255,0.18)",
                color: isActive ? "#1B1B1B" : "white",
                fontSize: 10, fontWeight: 900,
                borderRadius: 999, padding: "2px 6px",
              }}>{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GalleryPinCard({
  pinId, label, isOwned, isEquipped, canUse, onSelect,
}: {
  pinId: string;
  label: string;
  isOwned: boolean;
  isEquipped: boolean;
  canUse: boolean;
  onSelect: () => void;
}) {
  const cost = pinCostGems(pinId);
  const locked = !isOwned && cost > 0;
  const freeOwned = isOwned && cost === 0;

  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 5, padding: "8px 4px",
        background: isEquipped
          ? "rgba(255,213,79,0.12)"
          : canUse
            ? "rgba(255,213,79,0.06)"
            : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${isEquipped ? "#FFD740" : canUse ? "rgba(255,213,79,0.35)" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 14,
        cursor: "pointer",
        color: "white",
        opacity: canUse || locked || isOwned ? 1 : 0.55,
      }}
    >
      <PinIcon pinId={pinId} size={54} locked={locked} glow={isEquipped} animated />
      <div style={{
        fontSize: 10, fontWeight: 700, lineHeight: 1.15,
        color: isOwned ? "white" : "rgba(255,255,255,0.55)",
        textAlign: "center",
      }}>{label}</div>
      {locked ? (
        <motionPinModalHeader
      ) : isEquipped ? (
        <div style={{ fontSize: 9, fontWeight: 900, color: "#FFD740", letterSpacing: 0.5 }}>В СЛОТЕ</motionPinModalHeader
      ) : freeOwned ? (
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>бесплатно</motionPinModalHeader
      ) : (
        <div style={{ fontSize: 9, color: "#76FF03", fontWeight: 700 }}>в коллекции</motionPinModalHeader
      )}
    </button>
  );
}

function EmptySlot({ size, active }: { size: number; active: boolean }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.04)",
      border: `2px dashed ${active ? "#FFD740" : "rgba(255,255,255,0.25)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.4)",
      fontSize: size * 0.4,
    }}>＋</motionPinModalHeader
  );
}
'''

# fix helpers - remove accidental typos
helpers = helpers.replace('motionPinModalHeader', '')

path.write_text(text.rstrip() + "\n" + tail + helpers, encoding="utf-8")
print("appended", len(tail), "chars")
