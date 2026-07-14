/**
 * PinSelectModal — pin loadout editor.
 * 8 slots: 4 character + 4 universal (side by side).
 * Gallery: locked unpurchased pins show lock + gem price; tap to buy & equip.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { useI18n, brawlerName } from "../i18n";
import {
  PIN_EQUIP_SLOTS,
  PIN_CHARACTER_SLOTS,
  PIN_UNIVERSAL_SLOT_START,
  PIN_KIND_ORDER,
  UNIVERSAL_PINS,
  pinIdFor,
  pinCostGems,
  isUniversalPinId,
  isCollectiblePinId,
  slotAcceptsPin,
} from "../entities/PinData";
import {
  COLLECTIBLE_PINS,
  COLLECTIBLE_PIN_RARITY_LABEL,
  type CollectiblePinRarity,
} from "../entities/CollectiblePinData";
import { BRAWLERS } from "../entities/BrawlerData";
import {
  getCurrentProfile,
  getEquippedPins,
  getOwnedPins,
  isPinOwned,
  equipPin,
  purchasePinWithGems,
} from "../utils/localStorageAPI";
import PinIcon from "./PinIcon";
import { GemIcon } from "./GameIcons";
import { EmojiIcon, TextWithEmojis } from "./EmojiIcon";
import { PageBg, PageBody, PageHeader } from "./PageChrome";
import { Tr } from "../i18n/Tr";

interface PinSelectModalProps {
  brawlerId: string;
  onClose: () => void;
  /** Render inline (full-screen route) instead of portaling to document.body. */
  disablePortal?: boolean;
  /** Full menu page (shop/customization pattern) — not a fixed overlay. */
  layout?: "modal" | "page";
}

export default function PinSelectModal({
  brawlerId,
  onClose,
  disablePortal = false,
  layout = "modal",
}: PinSelectModalProps) {
  const isPage = layout === "page";
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [activeSlot, setActiveSlot] = useState(0);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const suppressBackdropCloseRef = useRef(true);

  useEffect(() => {
    if (isPage) return;
    suppressBackdropCloseRef.current = true;
    const id = requestAnimationFrame(() => {
      suppressBackdropCloseRef.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [isPage]);

  useEffect(() => {
    const timer = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(timer);
  }, []);

  const brawler = BRAWLERS.find(b => b.id === brawlerId);
  const brawlerGallery = useMemo(
    () => PIN_KIND_ORDER.map(kind => ({ pinId: pinIdFor(brawlerId, kind) })),
    [brawlerId],
  );

  if (!profile || !brawler) {
    if (isPage) {
      return (
        <PageBg variant="customization" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
          <PageHeader onBack={onClose} title={t("char.pins")} />
          <PageBody style={{ padding: 24 }}><Tr id="common.error" /></PageBody>
        </PageBg>
      );
    }
    const fallback = (
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 250000,
          background: "rgba(2,0,18,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <button type="button" className="ui-back-btn" onClick={onClose}>
          ← <Tr id="common.back" />
        </button>
      </div>
    );
    if (typeof document === "undefined" || disablePortal) return fallback;
    return createPortal(fallback, getAppPortalRoot());
  }

  const equipped = getEquippedPins(brawlerId, profile);
  const owned = new Set(getOwnedPins(profile));

  const characterEquipped = equipped.slice(0, PIN_CHARACTER_SLOTS);
  const universalEquipped = equipped.slice(PIN_UNIVERSAL_SLOT_START, PIN_EQUIP_SLOTS);

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 1800);
  }

  function handleSlotClick(slot: number) {
    if (slot === activeSlot && equipped[slot]) {
      const r = equipPin(brawlerId, slot, "");
      if (r.success) {
        setProfile(getCurrentProfile());
        flash(t("pin.slotCleared"));
      }
    } else {
      setActiveSlot(slot);
    }
  }

  function tryEquip(pinId: string, slot: number): boolean {
    const r = equipPin(brawlerId, slot, pinId);
    if (r.success) {
      setProfile(getCurrentProfile());
      return true;
    }
    flash(r.error || t("pin.failed"), "err");
    return false;
  }

  function handleGallerySelect(pinId: string) {
    if (!slotAcceptsPin(activeSlot, pinId)) {
      flash(
        isUniversalPinId(pinId) || isCollectiblePinId(pinId)
          ? t("pin.pickUniversalSlot")
          : t("pin.pickCharacterSlot"),
        "err",
      );
      return;
    }

    if (!isPinOwned(pinId, profile)) {
      const cost = pinCostGems(pinId);
      if (cost <= 0) {
        flash(t("pin.unavailable"), "err");
        return;
      }
      const r = purchasePinWithGems(pinId);
      if (!r.success) {
        flash(r.error || t("pin.buyFailed"), "err");
        return;
      }
      setProfile(getCurrentProfile());
      if (tryEquip(pinId, activeSlot)) {
        flash(t("pin.boughtEquipped", { cost: r.cost ?? 0 }));
      } else {
        flash(t("pin.bought", { cost: r.cost ?? 0 }));
      }
      return;
    }

    if (tryEquip(pinId, activeSlot)) {
      flash(t("pin.pinned"));
    }
  }

  const slotHint = activeSlot < PIN_CHARACTER_SLOTS
    ? t("pin.characterSlot", { n: activeSlot + 1 })
    : t("pin.universalSlot", { n: activeSlot - PIN_UNIVERSAL_SLOT_START + 1 });

  const pinEditor = (
    <>
        <div style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.30)",
          overflow: "visible",
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.55)",
            fontWeight: 800, marginBottom: 10,
          }}><Tr id="pin.equippedSection" /></div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <EquipSlotRow
              title={<> <EmojiIcon emoji="🎴" size={20} /> {brawlerName(brawler.id, brawler.name)} </>}
              slots={characterEquipped}
              slotOffset={0}
              activeSlot={activeSlot}
              onSlotClick={handleSlotClick}
            />
            <EquipSlotRow
              title={t("pin.universal")}
              slots={universalEquipped}
              slotOffset={PIN_UNIVERSAL_SLOT_START}
              activeSlot={activeSlot}
              onSlotClick={handleSlotClick}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14, minHeight: 200 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, color: "#FFD740", marginBottom: 8 }}>
                <Tr id="pin.characterPins" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {brawlerGallery.map(g => (
                  <GalleryPinCard
                    key={g.pinId}
                    pinId={g.pinId}
                    isOwned={owned.has(g.pinId)}
                    isEquipped={equipped.includes(g.pinId)}
                    canUse={slotAcceptsPin(activeSlot, g.pinId)}
                    onSelect={() => handleGallerySelect(g.pinId)}
                  />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, color: "#80DEEA", marginBottom: 8 }}>
                <Tr id="pin.universalPins" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {UNIVERSAL_PINS.map(u => (
                  <GalleryPinCard
                    key={u.id}
                    pinId={u.id}
                    isOwned={owned.has(u.id)}
                    isEquipped={equipped.includes(u.id)}
                    canUse={slotAcceptsPin(activeSlot, u.id)}
                    onSelect={() => handleGallerySelect(u.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <CollectiblePinsGallery
            owned={owned}
            equipped={equipped}
            activeSlot={activeSlot}
            onSelect={handleGallerySelect}
          />
        </div>

        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.40)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          minHeight: 36,
          gap: 8,
          flexWrap: "wrap",
        }}
        >
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            {t("pin.collection", {
              gameOwned: [...owned].filter(id => id.startsWith("g_")).length,
              gameTotal: COLLECTIBLE_PINS.length,
              charOwned: [...owned].filter(id => id.startsWith("pin:")).length,
            })}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#80DEEA", fontWeight: 800 }}>
            <GemIcon size={14} /> {profile.gems}
          </div>
          {msg && (
            <div style={{
              fontSize: 12, fontWeight: 800,
              color: msg.tone === "err" ? "#FF7070" : "#76FF03",
            }}><TextWithEmojis text={msg.text} emojiSize={24} /></div>
          )}
        </div>
    </>
  );

  if (isPage) {
    return (
      <PageBg variant="customization" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
        <PageHeader
          onBack={onClose}
          title={t("pin.title", { name: brawlerName(brawler.id, brawler.name) })}
          gems={profile.gems}
        />
        <div style={{ padding: "0 18px 8px", fontSize: 11, color: "rgba(255,255,255,0.55)", flexShrink: 0 }}>
          <Tr id="pin.subtitle" params={{ slot: slotHint }} />
        </div>
        <PageBody style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {pinEditor}
        </PageBody>
      </PageBg>
    );
  }

  const modal = (
    <div
      onClick={() => {
        if (suppressBackdropCloseRef.current) return;
        onClose();
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 250000,
        background: "rgba(2,0,18,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(780px, 96vw)",
          maxHeight: "92vh",
          background: "linear-gradient(180deg, rgba(90,40,140,0.22), rgba(45,20,75,0.16))",
          border: "1px solid rgba(180,120,255,0.42)",
          borderRadius: 18,
          backdropFilter: "blur(10px) saturate(1.2)",
          WebkitBackdropFilter: "blur(10px) saturate(1.2)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}><EmojiIcon emoji="💬" size={24} /></span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 1, color: "#FFD740" }}>
                <Tr id="pin.title" params={{ name: brawlerName(brawler.id, brawler.name) }} />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                <Tr id="pin.subtitle" params={{ slot: slotHint }} />
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10, padding: "6px 12px",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}><Tr id="pin.closeBtn" /></button>
        </div>
        {pinEditor}
      </div>
    </div>
  );

  if (typeof document === "undefined" || disablePortal) return modal;
  return createPortal(modal, getAppPortalRoot());
}

function EquipSlotRow({
  title, slots, slotOffset, activeSlot, onSlotClick,
}: {
  title: string;
  slots: string[];
  slotOffset: number;
  activeSlot: number;
  onSlotClick: (slot: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)",
        marginBottom: 8, textAlign: "center",
      }}>{title}</div>
      <div style={{ display: "flex", gap: 10, overflow: "visible", paddingTop: 4 }}>
        {slots.map((pinId, i) => {
          const slot = slotOffset + i;
          const isActive = slot === activeSlot;
          return (
            <button
              key={slot}
              onClick={() => onSlotClick(slot)}
              title={pinId ? t("pin.tapClear") : t("pin.pickBelow")}
              style={{
                position: "relative",
                background: "transparent",
                border: "none",
                padding: 4,
                borderRadius: 999,
                cursor: "pointer",
                outline: isActive ? "3px solid #FFD740" : "3px solid transparent",
                overflow: "visible",
              }}
            >
              {pinId ? (
                <PinIcon pinId={pinId} size={58} glow={isActive} animated />
              ) : (
                <EmptySlot size={58} active={isActive} />
              )}
              <span style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 5,
                minWidth: 18,
                height: 18,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "#FFD740" : "rgba(255,255,255,0.18)",
                color: isActive ? "#ffffff" : "white",
                textShadow: isActive ? "0 1px 2px rgba(0,0,0,0.85)" : undefined,
                fontSize: 10,
                fontWeight: 900,
                lineHeight: 1,
                borderRadius: 999,
                padding: "0 5px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
              }}>{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GalleryPinCard({
  pinId, isOwned, isEquipped, canUse, onSelect,
}: {
  pinId: string;
  isOwned: boolean;
  isEquipped: boolean;
  canUse: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
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
      {locked ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color: "#80DEEA" }}>
            <GemIcon size={11} /> {cost}
          </div>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, color: "rgba(255,255,255,0.5)" }}>
            <Tr id="common.buy" />
          </div>
        </div>
      ) : isEquipped ? (
        <div style={{ fontSize: 9, fontWeight: 900, color: "#FFD740", letterSpacing: 0.5 }}><Tr id="pin.inSlot" /></div>
      ) : freeOwned ? (
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}><Tr id="pin.free" /></div>
      ) : (
        <div style={{ fontSize: 9, color: "#76FF03", fontWeight: 700 }}><Tr id="pin.inCollection" /></div>
      )}
    </button>
  );
}

const COLLECTIBLE_RARITY_ORDER: CollectiblePinRarity[] = ["common", "rare", "epic", "unique", "golden"];

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
  const { t } = useI18n();
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, color: "#CE93D8", marginBottom: 10 }}>
        <Tr id="pin.collectible" />
      </div>
      {COLLECTIBLE_RARITY_ORDER.map(rarity => {
        const pins = COLLECTIBLE_PINS.filter(p => p.rarity === rarity);
        return (
          <div key={rarity} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 9, letterSpacing: 2, fontWeight: 800,
              color: RARITY_ACCENT[rarity], marginBottom: 8,
            }}>
              {COLLECTIBLE_PIN_RARITY_LABEL[rarity].toUpperCase()}
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
              gap: 10,
            }}>
              {pins.map(p => (
                <GalleryPinCard
                  key={p.id}
                  pinId={p.id}
                  isOwned={owned.has(p.id)}
                  isEquipped={equipped.includes(p.id)}
                  canUse={slotAcceptsPin(activeSlot, p.id)}
                  onSelect={() => onSelect(p.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
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
    }}>＋</div>
  );
}
