import { useEffect, useState } from "react";
import { BRAWLERS } from "../entities/BrawlerData";
import { BRAWLER_TRAILS, TRAIL_GEM_COST } from "../data/brawlerTrails";
import {
  getBrawlerTrailMode,
  getEquippedTrailForBrawler,
  getGlobalEquippedTrailId,
  isTrailOwned,
} from "../utils/trailEquip";
import {
  getCurrentProfile,
  setBrawlerIndividualMotionTrail,
  setBrawlerTrailMode,
} from "../utils/localStorageAPI";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import TrailWalkPreview from "../components/shop/TrailWalkPreview";
import { brawlerName, useI18n } from "../i18n";
import BrawlerSquareIcon from "../components/ranked/BrawlerSquareIcon";

interface Props {
  brawlerId: string;
  onBack: () => void;
  onOpenShop?: () => void;
}

export default function BrawlerTrailPage({ brawlerId, onBack, onOpenShop }: Props) {
  const { t } = useI18n();
  const brawler = BRAWLERS.find(b => b.id === brawlerId) ?? BRAWLERS[0];
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const id = setInterval(() => setProfile(getCurrentProfile()), 400);
    return () => clearInterval(id);
  }, []);

  if (!profile) {
    return (
      <PageBg variant="customization">
        <PageHeader title={t("nav.trails")} onBack={onBack} />
        <PageBody>{t("common.error")}</PageBody>
      </PageBg>
    );
  }

  const mode = getBrawlerTrailMode(profile, brawler.id);
  const activeTrailId = getEquippedTrailForBrawler(profile, brawler.id);
  const globalTrailId = getGlobalEquippedTrailId(profile);
  const ownedTrails = BRAWLER_TRAILS.filter(tr => isTrailOwned(profile, tr.id));

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2200);
  };

  return (
    <PageBg variant="customization">
      <PageHeader
        title={t("trail.pageTitle", { name: brawlerName(brawler.id, brawler.name) })}
        onBack={onBack}
        gems={profile.gems}
        coins={profile.coins}
      />
      <PageBody style={{ padding: "16px 18px 24px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <BrawlerSquareIcon brawlerId={brawler.id} size={72} static showMeta={false} showName={false} overlay="none" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 1000, color: "#fff" }}>{brawlerName(brawler.id, brawler.name)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginTop: 4 }}>
              {t("trail.pageSubtitle", { cost: TRAIL_GEM_COST })}
            </div>
          </div>
        </div>

        <div className="brawler-trail-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 320px)", gap: 16 }}>
          <div className="ui-glass" style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(206,147,216,0.35)" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 10 }}>{t("trail.modeTitle")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                border: mode === "global" ? "2px solid #CE93D8" : "1px solid rgba(255,255,255,0.12)",
                background: mode === "global" ? "rgba(126,87,194,0.2)" : "rgba(0,0,0,0.25)",
                cursor: "pointer",
              }}>
                <input
                  type="radio"
                  name="trailMode"
                  checked={mode === "global"}
                  onChange={() => {
                    const r = setBrawlerTrailMode(brawler.id, "global");
                    if (r.success) flash(t("trail.modeGlobalSaved"));
                    else flash(r.error ?? t("common.error"));
                    setProfile(getCurrentProfile());
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <div style={{ fontWeight: 900, color: "#fff", fontSize: 13 }}>{t("trail.modeGlobal")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 4, lineHeight: 1.35 }}>
                    {globalTrailId
                      ? BRAWLER_TRAILS.find(tr => tr.id === globalTrailId)?.name ?? t("trail.none")
                      : t("trail.noGlobal")}
                  </div>
                </span>
              </label>
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                border: mode === "individual" ? "2px solid #CE93D8" : "1px solid rgba(255,255,255,0.12)",
                background: mode === "individual" ? "rgba(126,87,194,0.2)" : "rgba(0,0,0,0.25)",
                cursor: "pointer",
              }}>
                <input
                  type="radio"
                  name="trailMode"
                  checked={mode === "individual"}
                  onChange={() => {
                    const r = setBrawlerTrailMode(brawler.id, "individual");
                    if (r.success) flash(t("trail.modeIndividualSaved"));
                    else flash(r.error ?? t("common.error"));
                    setProfile(getCurrentProfile());
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <div style={{ fontWeight: 900, color: "#fff", fontSize: 13 }}>{t("trail.modeIndividual")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 4, lineHeight: 1.35 }}>
                    {t("trail.modeIndividualHint")}
                  </div>
                </span>
              </label>
            </div>

            {mode === "individual" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{t("trail.pickTrail")}</div>
                {ownedTrails.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                    {t("trail.buyInShop")}
                    {onOpenShop && (
                      <button type="button" className="ui-btn ui-btn--primary" style={{ marginTop: 10, display: "block" }} onClick={onOpenShop}>
                        {t("trail.openShop")}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const r = setBrawlerIndividualMotionTrail(brawler.id, null);
                        if (r.success) flash(t("trail.noneActive"));
                        else flash(r.error ?? t("common.error"));
                        setProfile(getCurrentProfile());
                      }}
                      style={{
                        padding: 8,
                        borderRadius: 10,
                        border: !profile.equippedMotionTrailByBrawler?.[brawler.id]
                          ? "2px solid #A5D6A7"
                          : "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(0,0,0,0.35)",
                        color: "rgba(255,255,255,0.75)",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 800,
                        textAlign: "left",
                      }}
                    >
                      {t("trail.none")}
                    </button>
                    {ownedTrails.map(tr => {
                      const selected = profile.equippedMotionTrailByBrawler?.[brawler.id] === tr.id;
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            const r = setBrawlerIndividualMotionTrail(brawler.id, tr.id);
                            if (r.success) flash(t("trail.equipped"));
                            else flash(r.error ?? t("common.error"));
                            setProfile(getCurrentProfile());
                          }}
                          style={{
                            padding: 8,
                            borderRadius: 10,
                            border: selected ? "2px solid #A5D6A7" : "1px solid rgba(255,255,255,0.12)",
                            background: `linear-gradient(135deg, ${tr.color}33, rgba(0,0,0,0.35))`,
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 800,
                            textAlign: "left",
                          }}
                        >
                          {tr.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {onOpenShop && (
              <button type="button" className="ui-btn ui-btn--ghost" style={{ marginTop: 14 }} onClick={onOpenShop}>
                {t("trail.openShop")}
              </button>
            )}
          </div>

          <aside className="ui-glass" style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(206,147,216,0.35)" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{t("shop.trails.preview")}</div>
            <TrailWalkPreview trailId={activeTrailId} brawlerId={brawler.id} width={340} height={220} />
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.35 }}>
              {activeTrailId
                ? BRAWLER_TRAILS.find(tr => tr.id === activeTrailId)?.name
                : t("trail.noneActive")}
            </div>
          </aside>
        </div>

        {msg && (
          <div className="ui-glass" style={{ marginTop: 14, padding: 12, textAlign: "center", color: "#CE93D8", fontWeight: 800 }}>
            {msg}
          </div>
        )}
        <style>{`
          @media (max-width: 640px) {
            .brawler-trail-layout {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </PageBody>
    </PageBg>
  );
}
