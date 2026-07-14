import { useEffect, useMemo, useRef, useState } from "react";
import { BRAWLER_TRAILS, TRAIL_GEM_COST } from "../../data/brawlerTrails";
import { brawlerAvatarUrl } from "../../utils/modeAssets";
import {
  getGlobalEquippedTrailId,
  isTrailOwned,
} from "../../utils/trailEquip";
import type { UserProfile } from "../../utils/localStorageAPI";
import { GemIcon } from "../GameIcons";
import { TabHeader } from "./ShopTabParts";
import { shopBtnLabel } from "./shopButtonStyles";
import { useI18n } from "../../i18n";
import TrailWalkPreview from "./TrailWalkPreview";
import TrailChipPreview from "./TrailChipPreview";

export default function TrailsShopTab({
  profile,
  onBuy,
  onEquipGlobal,
}: {
  profile: UserProfile;
  onBuy: (trailId: string) => void;
  onEquipGlobal: (trailId: string | null) => void;
}) {
  const { t } = useI18n();
  const previewAsideRef = useRef<HTMLElement>(null);
  const ownedIds = profile.unlockedBrawlers.filter(Boolean);
  const [previewBrawlerId, setPreviewBrawlerId] = useState(ownedIds[0] ?? "miya");
  const [selectedId, setSelectedId] = useState<string | null>(
    getGlobalEquippedTrailId(profile),
  );

  useEffect(() => {
    if (ownedIds.length > 0 && !ownedIds.includes(previewBrawlerId)) {
      setPreviewBrawlerId(ownedIds[0]!);
    }
  }, [ownedIds, previewBrawlerId]);

  const globalEquipped = getGlobalEquippedTrailId(profile);

  const previewTrail = (trailId: string) => {
    setSelectedId(trailId);
    previewAsideRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const sorted = useMemo(
    () => [...BRAWLER_TRAILS].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [],
  );

  return (
    <div className="trails-shop-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 340px)", gap: 16 }}>
      <div>
        <TabHeader
          title={t("shop.trails.header")}
          subtitle={t("shop.trails.subtitle", { cost: TRAIL_GEM_COST })}
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
        }}>
          {sorted.map(trail => {
            const owned = isTrailOwned(profile, trail.id);
            const equipped = globalEquipped === trail.id;
            const active = selectedId === trail.id;
            const canBuy = !owned && profile.gems >= TRAIL_GEM_COST;
            return (
              <button
                key={trail.id}
                type="button"
                onClick={() => setSelectedId(trail.id)}
                className="ui-glass"
                style={{
                  padding: 10,
                  textAlign: "left",
                  borderRadius: 14,
                  cursor: "pointer",
                  border: active
                    ? "2px solid #CE93D8"
                    : equipped
                      ? "1px solid rgba(129,199,132,0.65)"
                      : "1px solid rgba(206,147,216,0.35)",
                  background: active ? "rgba(126,87,194,0.25)" : "rgba(0,0,0,0.28)",
                  color: "#fff",
                }}
              >
                <TrailChipPreview trail={trail} />
                <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>{trail.name}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                  {trail.layer === "air" ? t("shop.trails.layerAir")
                    : trail.layer === "ground" ? t("shop.trails.layerGround")
                      : t("shop.trails.layerBoth")}
                </div>
                {owned ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: equipped ? "#A5D6A7" : "rgba(255,255,255,0.65)",
                    }}>
                      {equipped ? t("shop.trails.equipped") : t("shop.trails.owned")}
                    </span>
                    {!equipped && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onEquipGlobal(trail.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onEquipGlobal(trail.id); } }}
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          color: "#CE93D8",
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        {t("shop.trails.setGlobal")}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); previewTrail(trail.id); }}
                      style={shopBtnLabel(
                        "rgba(126,87,194,0.35)",
                        "#E1BEE7",
                        {
                          flex: "1 1 0",
                          padding: "5px 8px",
                          fontWeight: 900,
                          fontSize: 10,
                          borderRadius: 8,
                          cursor: "pointer",
                          border: "1px solid rgba(206,147,216,0.45)",
                        },
                      )}
                    >
                      {t("shop.trails.tryPreview")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onBuy(trail.id); }}
                      disabled={!canBuy}
                      style={shopBtnLabel(
                        canBuy ? "linear-gradient(135deg, #7E57C2, #4527A0)" : "rgba(255,255,255,0.08)",
                        canBuy ? "#ffffff" : "rgba(255,255,255,0.55)",
                        {
                          flex: "1 1 0",
                          padding: "5px 8px",
                          fontWeight: 900,
                          fontSize: 11,
                          borderRadius: 8,
                          cursor: canBuy ? "pointer" : "not-allowed",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        },
                      )}
                    >
                      <GemIcon size={11} /> {TRAIL_GEM_COST}
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <aside
        ref={previewAsideRef}
        className="ui-glass"
        style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(206,147,216,0.35)",
        alignSelf: "start",
        position: "sticky",
        top: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
          {t("shop.trails.preview")}
        </div>
        {selectedId && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", marginBottom: 8, lineHeight: 1.3 }}>
            {sorted.find(tr => tr.id === selectedId)?.name}
            {!isTrailOwned(profile, selectedId) && (
              <span style={{ color: "#CE93D8" }}> · {t("shop.trails.tryPreviewHint")}</span>
            )}
          </div>
        )}
        <TrailWalkPreview
          key={previewBrawlerId}
          trailId={selectedId}
          brawlerId={previewBrawlerId}
          width={360}
          height={240}
        />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>
            {t("shop.trails.pickBrawler")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 120, overflowY: "auto" }}>
            {ownedIds.map(id => (
              <button
                key={id}
                type="button"
                onClick={() => setPreviewBrawlerId(id)}
                style={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  borderRadius: 8,
                  border: previewBrawlerId === id ? "2px solid #CE93D8" : "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(0,0,0,0.35)",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <img
                  src={brawlerAvatarUrl(id)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            ))}
          </div>
        </div>
        {globalEquipped && (
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            style={{ marginTop: 12, width: "100%", fontSize: 11 }}
            onClick={() => onEquipGlobal(null)}
          >
            {t("shop.trails.clearGlobal")}
          </button>
        )}
      </aside>
      <style>{`
        @media (max-width: 720px) {
          .trails-shop-layout {
            grid-template-columns: 1fr !important;
          }
          .trails-shop-layout aside {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
