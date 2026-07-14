import { useState, useEffect } from "react";
import { consumeGiftRecipientPrefill } from "../utils/social/friendship";
import { parsePinId } from "../entities/PinData";
import {
  getCurrentProfile,
  purchasePinWithGems,
  purchaseProfileIcon,
  purchasePortraitBackground,
  purchaseMotionTrail,
  setGlobalEquippedMotionTrail,
} from "../utils/localStorageAPI";
import { PORTRAIT_BACKGROUND_BY_ID } from "../data/portraitBackgrounds";
import { PageBg, PageBody, PageHeader, PageToolbar } from "../components/PageChrome";
import PinsShopTab from "../components/shop/PinsShopTab";
import ProfileIconsShopTab from "../components/shop/ProfileIconsShopTab";
import PortraitBackgroundsShopTab from "../components/shop/PortraitBackgroundsShopTab";
import TrailsShopTab from "../components/shop/TrailsShopTab";
import GiftPacksShopTab from "../components/shop/GiftPacksShopTab";
import RewardDropQueue from "../components/RewardDropQueue";
import { rewardInfoForPin, rewardInfoForProfileIcon } from "../utils/shopRewards";
import type { RewardInfo } from "../components/RewardDropModal";
import { useI18n } from "../i18n";
import { TabButtonWithIcon } from "../components/ui/ButtonLeftIcon";
import { UI_BUTTON_ICONS } from "../data/uiButtonIcons";

type CustomTab = "pins" | "icons" | "gifts" | "backgrounds" | "trails";

const TAB_DEFS: { id: CustomTab; labelKey: string; iconSrc: string; color: string }[] = [
  { id: "pins", labelKey: "custom.tab.pins", iconSrc: UI_BUTTON_ICONS.customTab.pins, color: "#7E57C2" },
  { id: "icons", labelKey: "custom.tab.icons", iconSrc: UI_BUTTON_ICONS.customTab.icons, color: "#CE93D8" },
  { id: "backgrounds", labelKey: "custom.tab.backgrounds", iconSrc: UI_BUTTON_ICONS.customTab.backgrounds, color: "#9575CD" },
  { id: "trails", labelKey: "custom.tab.trails", iconSrc: UI_BUTTON_ICONS.customTab.trails, color: "#4FC3F7" },
  { id: "gifts", labelKey: "custom.tab.gifts", iconSrc: UI_BUTTON_ICONS.customTab.gifts, color: "#FF80AB" },
];

export default function CustomizationPage({
  onBack,
  initialTab = "pins",
}: {
  onBack: () => void;
  initialTab?: CustomTab;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [giftPrefillId] = useState(() => consumeGiftRecipientPrefill());
  const [activeTab, setActiveTab] = useState<CustomTab>(() => (giftPrefillId ? "gifts" : initialTab));
  const [msg, setMsg] = useState("");
  const [rewardQueue, setRewardQueue] = useState<RewardInfo[] | null>(null);

  const refresh = () => setProfile(getCurrentProfile());

  useEffect(() => {
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (giftPrefillId) return;
    setActiveTab(initialTab);
  }, [initialTab, giftPrefillId]);

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2200);
  };

  return (
    <PageBg variant="customization" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
      <PageHeader
        onBack={onBack}
        title={t("custom.title")}
        coins={profile?.coins || 0}
        gems={profile?.gems || 0}
        power={profile?.powerPoints || 0}
      />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <PageToolbar style={{
          display: "flex", justifyContent: "center", padding: "14px 14px 10px",
          background: "linear-gradient(180deg, rgba(6,4,18,0.55), rgba(6,4,18,0.22))",
          borderBottom: "1px solid var(--bd-1)",
        }}>
          <div className="ui-tab-bar" style={{ flexWrap: "wrap", overflow: "visible" }}>
            {TAB_DEFS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <span key={tab.id} data-unlock-target={`customTab-${tab.id}`} style={{ display: "inline-flex" }}>
                <TabButtonWithIcon
                  active={active}
                  color={tab.color}
                  iconSrc={tab.iconSrc}
                  glowColor={tab.color}
                  onClick={() => setActiveTab(tab.id)}
                  style={active ? { borderColor: tab.color, boxShadow: `0 0 12px ${tab.color}55` } : undefined}
                >
                  {t(tab.labelKey)}
                </TabButtonWithIcon>
                </span>
              );
            })}
          </div>
        </PageToolbar>
        <PageBody className="shop-scroll-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px 28px" }}>
          {activeTab === "pins" && profile && (
            <PinsShopTab
              profileGems={profile.gems}
              onBuy={(pinId) => {
                const parsed = parsePinId(pinId);
                if (parsed && !profile.unlockedBrawlers.includes(parsed.brawlerId)) {
                  showMsg(t("custom.needBrawler"));
                  return;
                }
                const r = purchasePinWithGems(pinId);
                if (r.success) {
                  refresh();
                  setRewardQueue([rewardInfoForPin(pinId)]);
                } else showMsg(r.error || t("common.error"));
              }}
            />
          )}
          {activeTab === "icons" && profile && (
            <ProfileIconsShopTab
              profile={profile}
              onBuy={(iconId) => {
                const r = purchaseProfileIcon(iconId);
                if (r.success) {
                  refresh();
                  setRewardQueue([rewardInfoForProfileIcon(iconId)]);
                } else showMsg(r.error || t("common.error"));
              }}
            />
          )}
          {activeTab === "backgrounds" && profile && (
            <PortraitBackgroundsShopTab
              profile={profile}
              onBuy={(backgroundId) => {
                const r = purchasePortraitBackground(backgroundId);
                if (r.success) {
                  refresh();
                  const label = PORTRAIT_BACKGROUND_BY_ID.get(backgroundId)?.label ?? t("shop.portraitBg.reward");
                  showMsg(t("shop.portraitBg.purchased", { label }));
                } else showMsg(r.error || t("common.error"));
              }}
            />
          )}
          {activeTab === "trails" && profile && (
            <TrailsShopTab
              profile={profile}
              onBuy={(trailId) => {
                const r = purchaseMotionTrail(trailId);
                if (r.success) {
                  refresh();
                  showMsg(t("shop.trails.purchased"));
                } else showMsg(r.error || t("common.error"));
              }}
              onEquipGlobal={(trailId) => {
                const r = setGlobalEquippedMotionTrail(trailId);
                if (r.success) {
                  refresh();
                  showMsg(trailId ? t("shop.trails.globalEquipped") : t("shop.trails.globalCleared"));
                } else showMsg(r.error || t("common.error"));
              }}
            />
          )}
          {activeTab === "gifts" && profile && (
            <GiftPacksShopTab profileGems={profile.gems} onSent={refresh} initialRecipientId={giftPrefillId} />
          )}
          {msg && (
            <div className="ui-glass" style={{ marginTop: 18, textAlign: "center", padding: 14, color: "var(--c-gold-3)", fontWeight: 800 }}>
              {msg}
            </div>
          )}
        </PageBody>
      </div>
      {rewardQueue && rewardQueue.length > 0 && (
        <RewardDropQueue
          key={rewardQueue.map(r => r.label).join("|")}
          rewards={rewardQueue}
          onDone={() => { setRewardQueue(null); refresh(); }}
        />
      )}
    </PageBg>
  );
}
