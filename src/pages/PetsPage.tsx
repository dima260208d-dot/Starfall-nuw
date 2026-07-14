import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  PETS, PET_RARITY_LABEL, PET_RARITY_ORDER,
  type PetDef,
} from "../entities/PetData";
import { getEffectivePetGemCost } from "../utils/characterBalance";
import {
  getCurrentProfile, equipPet, markPetSeen,
  unlockPetWithGems, renamePet, getPetCustomName, getPetDisplayName,
  petHasCustomName, RENAME_GEM_COST,
} from "../utils/localStorageAPI";
import PetSvg from "../components/PetSvg";
import { PetGridCard, PET_RARITY_TINT } from "../components/PetGridCard";
import { petPageBackgroundStyle } from "../game/pet3DRenderer";
import { GemIcon } from "../components/GameIcons";
import { useI18n, petName, petDescription, petEffectLabel, petRarityLabel } from "../i18n";
import { EmojiIcon } from "../components/EmojiIcon";

interface PetsPageProps {
  onBack: () => void;
}

export default function PetsPage({ onBack }: PetsPageProps) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [petNameInput, setPetNameInput] = useState("");

  const ownedPets = useMemo(() => {
    if (!profile) return [];
    const owned = (profile.unlockedPets || []);
    return PETS.filter(p => owned.includes(p.id))
      .sort((a, b) =>
        PET_RARITY_ORDER.indexOf(b.rarity) - PET_RARITY_ORDER.indexOf(a.rarity)
        || a.name.localeCompare(b.name));
  }, [profile]);

  const lockedPets = useMemo(() => {
    if (!profile) return [];
    const owned = new Set(profile.unlockedPets || []);
    return PETS.filter(p => !owned.has(p.id))
      .sort((a, b) =>
        PET_RARITY_ORDER.indexOf(a.rarity) - PET_RARITY_ORDER.indexOf(b.rarity));
  }, [profile]);

  const activeId = selectedId
    && (ownedPets.some(p => p.id === selectedId) || lockedPets.some(p => p.id === selectedId))
      ? selectedId
      : (ownedPets[0]?.id ?? lockedPets[0]?.id ?? null);

  // Mark currently displayed new pet as seen.
  useEffect(() => {
    if (!activeId) return;
    const cur = getCurrentProfile();
    if (!(cur?.newPets || []).includes(activeId)) return;
    markPetSeen(activeId);
    setProfile(getCurrentProfile());
  }, [activeId]);

  useEffect(() => {
    setNameModalOpen(false);
    setPetNameInput(activeId ? (getPetCustomName(activeId, profile) ?? "") : "");
  }, [activeId, profile?.petCustomNames]);

  useEffect(() => {
    if (!nameModalOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [nameModalOpen]);

  if (!profile) return null;

  const active: PetDef | null = activeId
    ? (PETS.find(p => p.id === activeId) ?? null)
    : null;
  const isOwned = active ? (profile.unlockedPets || []).includes(active.id) : false;
  const isEquipped = active ? profile.equippedPetId === active.id : false;

  const handleEquip = (petId: string | null) => {
    const r = equipPet(petId);
    if (r.success) {
      setProfile(getCurrentProfile());
      setMsg(petId ? t("pets.equipped") : t("pets.unequipped"));
    } else {
      setMsg(r.error || t("pets.failed"));
    }
    setTimeout(() => setMsg(""), 1800);
  };

  const handleUnlock = (petId: string) => {
    const r = unlockPetWithGems(petId);
    if (r.success) {
      setProfile(getCurrentProfile());
      setMsg(t("pets.purchased"));
      setSelectedId(petId);
    } else {
      setMsg(r.error || t("pets.purchaseFailed"));
    }
    setTimeout(() => setMsg(""), 1800);
  };

  const handleRenamePet = () => {
    if (!active) return;
    const r = renamePet(active.id, petNameInput);
    if (r.success) {
      setProfile(getCurrentProfile());
      setNameModalOpen(false);
      setMsg(t("pets.nameSaved"));
    } else {
      setMsg(r.error || t("pets.nameFailed"));
    }
    setTimeout(() => setMsg(""), 2200);
  };

  const activeCustomName = active ? getPetCustomName(active.id, profile) : null;
  const activeDisplayName = active
    ? getPetDisplayName(active.id, petName(active.id, active.name), profile)
    : "";

  const base = import.meta.env.BASE_URL;
  const selectPet = useCallback((id: string) => setSelectedId(id), []);
  const equippedBadgeLabel = t("pets.equippedBadge");

  return (
    <div style={{
      height: "100%",
      color: "white", display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      <PetsPageBackground base={base} pet={active} />

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: "14px 22px",
        borderBottom: "1px solid rgba(118,255,3,0.18)",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}>
        <button onClick={onBack} style={{
          background: "rgba(118,255,3,0.10)",
          border: "1px solid rgba(118,255,3,0.35)",
          borderRadius: 10, padding: "7px 16px",
          color: "#B2FF59", cursor: "pointer", fontSize: 13, fontWeight: 700,
        }}>← {t("common.back")}</button>
        <h2 style={{
          flex: 1, textAlign: "center", margin: 0,
          fontSize: 22, fontWeight: 900, letterSpacing: 2,
          color: "#B2FF59",
          textShadow: "0 0 14px rgba(118,255,3,0.45)",
        }}><EmojiIcon emoji="🐾" size={22} /> {t("pets.title")}</h2>
        <div style={{
          minWidth: 100, textAlign: "right",
          fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 700,
        }}>
          {ownedPets.length} / {PETS.length}
        </div>
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        flex: 1, display: "flex", overflow: "visible",
        flexDirection: "row",
      }}>
        {/* Detail panel — transparent so pet background shows through */}
        <div style={{
          flex: "0 0 380px", padding: 22,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 16,
          borderRight: "1px solid rgba(118,255,3,0.18)",
          background: "transparent",
          overflow: "visible",
        }}>
          {active ? (
            <>
              <div style={{
                fontSize: 10, fontWeight: 900, letterSpacing: 2,
                background: PET_RARITY_TINT[active.rarity], color: "white",
                borderRadius: 8, padding: "3px 10px",
                boxShadow: `0 0 10px ${PET_RARITY_TINT[active.rarity]}66`,
              }}>{petRarityLabel(active.rarity, PET_RARITY_LABEL[active.rarity])}</div>
              <div style={{
                width: 250,
                height: active.id === "swift_rabbit" ? 248 : 210,
                margin: "8px 0",
                display: "flex", alignItems: "center", justifyContent: "center",
                filter: isOwned ? "none" : "grayscale(0.7) brightness(0.55)",
                background: `radial-gradient(ellipse 80% 70% at 50% 60%, ${active.color}33 0%, transparent 70%)`,
                overflow: "visible",
                flexShrink: 0,
              }}>
                <PetDetailPreview
                  pet={active}
                  isOwned={isOwned}
                />
              </div>
              <div style={{
                fontSize: 24, fontWeight: 900, color: active.color, letterSpacing: 1,
                textShadow: "0 2px 6px rgba(0,0,0,0.6)",
              }}>{activeDisplayName}</div>
              <div style={{
                fontSize: 12, color: "rgba(255,255,255,0.78)",
                textAlign: "center", lineHeight: 1.5, maxWidth: 320,
              }}>{petDescription(active.id, active.description)}</div>
              <div style={{
                marginTop: 6, padding: "10px 14px",
                background: `${active.color}1A`,
                border: `1px solid ${active.color}55`,
                borderRadius: 12,
                fontSize: 13, fontWeight: 800, color: active.color, textAlign: "center",
                boxShadow: `0 0 10px ${active.color}33`,
              }}><EmojiIcon emoji="⚡" size={21} /> {petEffectLabel(active.id, active.effectLabel)}</div>

              {/* Action */}
              <div style={{ marginTop: 14, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {isOwned && (
                  <button
                    type="button"
                    onClick={() => {
                      setPetNameInput(activeCustomName ?? "");
                      setNameModalOpen(true);
                    }}
                    style={{
                      width: "100%", padding: "11px 14px",
                      background: "rgba(118,255,3,0.12)",
                      border: "1px solid rgba(118,255,3,0.35)",
                      borderRadius: 12, color: "#B2FF59",
                      fontWeight: 800, fontSize: 13, cursor: "pointer",
                      letterSpacing: 0.5,
                    }}
                  >
                    {t("pets.giveName")}
                  </button>
                )}
                {isOwned ? (
                  isEquipped ? (
                    <button
                      onClick={() => handleEquip(null)}
                      style={{
                        width: "100%", padding: "12px 0",
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 12,
                        color: "rgba(255,255,255,0.85)", fontWeight: 800, fontSize: 13,
                        letterSpacing: 1, cursor: "pointer",
                      }}
                    >{t("pets.unequip")}</button>
                  ) : (
                    <button
                      onClick={() => handleEquip(active.id)}
                      style={{
                        width: "100%", padding: "12px 0",
                        background: `linear-gradient(135deg, ${active.color}, ${active.secondaryColor})`,
                        border: "none", borderRadius: 12,
                        color: "white", fontWeight: 900, fontSize: 14,
                        letterSpacing: 1.5, cursor: "pointer",
                        boxShadow: `0 4px 14px ${active.color}66`,
                      }}
                    >{t("pets.equip")}</button>
                  )
                ) : (
                  <>
                    <div style={{
                      width: "100%", padding: "10px 0", textAlign: "center",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px dashed rgba(255,255,255,0.18)",
                      borderRadius: 12,
                      color: "rgba(255,255,255,0.55)", fontWeight: 700, fontSize: 12,
                      letterSpacing: 1,
                    }}>
                      {t("pets.lockedHint")} <GemIcon size={11} /> {getEffectivePetGemCost(active.rarity)}
                    </div>
                    <button
                      onClick={() => handleUnlock(active.id)}
                      disabled={profile.gems < getEffectivePetGemCost(active.rarity)}
                      style={{
                        width: "100%", padding: "12px 0",
                        background: profile.gems >= getEffectivePetGemCost(active.rarity)
                          ? "linear-gradient(135deg, #0288D1, #40C4FF)"
                          : "rgba(255,255,255,0.08)",
                        border: "none", borderRadius: 12,
                        color: profile.gems >= getEffectivePetGemCost(active.rarity) ? "white" : "rgba(255,255,255,0.4)",
                        fontWeight: 900, fontSize: 13, letterSpacing: 1.2,
                        cursor: profile.gems >= getEffectivePetGemCost(active.rarity) ? "pointer" : "default",
                      }}
                    >
                      {t("pets.buyFor", { cost: getEffectivePetGemCost(active.rarity) })}
                    </button>
                  </>
                )}
                {msg && (
                  <div style={{
                    fontSize: 11, color: "#B2FF59", textAlign: "center", fontWeight: 700,
                  }}>{msg}</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 50 }}>
              {t("pets.empty")}
            </div>
          )}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, padding: 22, overflowY: "auto", position: "relative", zIndex: 1 }}>
          {ownedPets.length > 0 && (
            <Section title={t("pets.sectionOwned")} count={ownedPets.length}>
              <Grid>
                {ownedPets.map(p => (
                  <PetGridCard
                    key={p.id}
                    pet={p}
                    owned
                    displayName={getPetDisplayName(p.id, petName(p.id, p.name), profile)}
                    isEquipped={profile.equippedPetId === p.id}
                    isNew={(profile.newPets || []).includes(p.id)}
                    selected={p.id === activeId}
                    equippedLabel={equippedBadgeLabel}
                    onClick={() => selectPet(p.id)}
                  />
                ))}
              </Grid>
            </Section>
          )}
          {lockedPets.length > 0 && (
            <Section title={t("pets.sectionLocked")} count={lockedPets.length}>
              <Grid>
                {lockedPets.map(p => (
                  <PetGridCard
                    key={p.id}
                    pet={p}
                    owned={false}
                    isEquipped={false}
                    isNew={false}
                    selected={p.id === activeId}
                    onClick={() => selectPet(p.id)}
                  />
                ))}
              </Grid>
            </Section>
          )}
        </div>
      </div>

      {nameModalOpen && active && isOwned && (
        <div
          role="dialog"
          aria-modal
          onClick={() => setNameModalOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 360,
              padding: "22px 20px",
              borderRadius: 16,
              background: "linear-gradient(165deg, rgba(32,48,28,0.98), rgba(8,16,8,0.98))",
              border: `1px solid ${active.color}66`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 24px ${active.color}33`,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "#B2FF59", marginBottom: 14, textAlign: "center" }}>
              {t("pets.giveName")}
            </div>
            <input
              value={petNameInput}
              onChange={e => setPetNameInput(e.target.value)}
              maxLength={16}
              placeholder={t("pets.namePlaceholder")}
              className="ui-input"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", fontSize: 14 }}
            />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 8, textAlign: "center" }}>
              {petHasCustomName(active.id, profile)
                ? t("pets.renameCost", { cost: RENAME_GEM_COST })
                : t("pets.renameFree")}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={handleRenamePet}
                className="ui-btn ui-btn--success"
                style={{ flex: 1, fontSize: 13, fontWeight: 800 }}
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => setNameModalOpen(false)}
                className="ui-btn ui-btn--secondary"
                style={{ flex: 1, fontSize: 13 }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, color: "rgba(178,255,89,0.85)",
        letterSpacing: 3, fontWeight: 800, marginBottom: 10, paddingLeft: 4,
      }}>{title} <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>{count}</span></div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
      gap: 12,
    }}>{children}</div>
  );
}

/** Фон меняется отдельно — не трогает сетку с 3D-моделями. */
const PetsPageBackground = memo(function PetsPageBackground({
  base, pet,
}: { base: string; pet: PetDef | null }) {
  const pageBg = petPageBackgroundStyle(base, pet);
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: pageBg.backgroundImage,
          backgroundColor: pageBg.backgroundColor,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          transition: "background-color 0.35s ease",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </>
  );
}, (a, b) => a.base === b.base && a.pet?.id === b.pet?.id);

/** Большое превью слева — пересоздаётся только при смене питомца. */
const PetDetailPreview = memo(function PetDetailPreview({
  pet, isOwned,
}: { pet: PetDef; isOwned: boolean }) {
  const isRabbit = pet.id === "swift_rabbit";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: isRabbit ? "translateY(4px)" : undefined,
    }}>
      <PetSvg
        pet={pet}
        size={172}
        animated={isOwned}
        haloPulse={isOwned}
        clipPadding={isRabbit ? 1.3 : 1.12}
      />
    </div>
  );
}, (a, b) => a.pet.id === b.pet.id && a.isOwned === b.isOwned);

