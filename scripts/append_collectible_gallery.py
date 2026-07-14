# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("src/components/PinSelectModal.tsx")
s = p.read_text(encoding="utf-8")
s = s.replace("motionPinModalHeader", "motionPinModalHeader")
s = s.replace("motionPinModalHeader", "div")

marker = "function EmptySlot({ size, active }"

component = '''const COLLECTIBLE_RARITY_ORDER: CollectiblePinRarity[] = ["common", "rare", "epic", "unique", "golden"];

const RARITY_ACCENT: Record<CollectiblePinRarity, string> = {
  common: "#B0BEC5",
  rare: "#4FC3F7",
  epic: "#BA68C8",
  unique: "#FF7043",
  golden: "#FFD700",
};

function CollectiblePinsGallery({
  owned, equipped, activeSlot, onSelect,
}: {
  owned: Set<string>;
  equipped: string[];
  activeSlot: number;
  onSelect: (pinId: string) => void;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, color: "#CE93D8", marginBottom: 10 }}>
        🎮 КОЛЛЕКЦИОННЫЕ ПИНЫ
      </motionPinModalHeader
      {COLLECTIBLE_RARITY_ORDER.map(rarity => {
        const pins = COLLECTIBLE_PINS.filter(p => p.rarity === rarity);
        return (
          <div key={rarity} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 9, letterSpacing: 2, fontWeight: 800,
              color: RARITY_ACCENT[rarity], marginBottom: 8,
            }}>
              {COLLECTIBLE_PIN_RARITY_LABEL[rarity].toUpperCase()}
            </motionPinModalHeader
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
              gap: 10,
            }}>
              {pins.map(p => (
                <GalleryPinCard
                  key={p.id}
                  pinId={p.id}
                  label={p.label}
                  isOwned={owned.has(p.id)}
                  isEquipped={equipped.includes(p.id)}
                  canUse={slotAcceptsPin(activeSlot, p.id)}
                  onSelect={() => onSelect(p.id)}
                />
              ))}
            </motionPinModalHeader
          </motionPinModalHeader
        );
      })}
    </motionPinModalHeader
  );
}

'''

component = component.replace("motionPinModalHeader", "div")

# remove broken partial CollectiblePinsGallery if present
if "function CollectiblePinsGallery" in s:
    start = s.find("const COLLECTIBLE_RARITY_ORDER")
    if start < 0:
        start = s.find("function CollectiblePinsGallery")
    end = s.find(marker)
    if start >= 0 and end > start:
        s = s[:start] + s[end:]

if "function CollectiblePinsGallery" not in s:
    s = s.replace(marker, component + marker)

p.write_text(s, encoding="utf-8")
print("done")
