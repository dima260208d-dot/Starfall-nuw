import { useEffect, useState } from "react";
import { getUiAssetBaseUrl } from "../../lib/assetBase";
import TutorialAstralBubble from "../tutorial/TutorialAstralBubble";
import {
  completeUnlockGuideFeature,
  getUnlockGuideDef,
  peekUnlockGuide,
  UNLOCK_GUIDE_CHANGED,
  type UnlockGuideDefinition,
} from "../../utils/progression/unlockGuideState";
import type { TrophyFeatureId } from "../../utils/progression/trophyUnlocks";
import { useI18n } from "../../i18n/I18nProvider";

const HAND_SRC = `${getUiAssetBaseUrl()}ui/tutorial-hand-pointer.png`;

type GuidePhase = "point_open" | "explain" | "point_tab" | "explain_tab";

interface Props {
  screen: string;
  /** Customization tab id when on customization screen */
  customizationTab?: string;
  onRequestCustomizationTab?: (tabId: string) => void;
}

function targetRect(selector: string): DOMRect | null {
  const el = document.querySelector(`[data-unlock-target="${selector}"]`);
  return el?.getBoundingClientRect() ?? null;
}

export default function UnlockGuideOverlay({ screen, customizationTab, onRequestCustomizationTab }: Props) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<TrophyFeatureId | null>(() => peekUnlockGuide());
  const [phase, setPhase] = useState<GuidePhase>("point_open");
  const [tabIndex, setTabIndex] = useState(0);
  const [handPos, setHandPos] = useState<{ x: number; y: number; rot: number } | null>(null);
  const [pulse, setPulse] = useState(0);

  const def: UnlockGuideDefinition | undefined = activeId ? getUnlockGuideDef(activeId) : undefined;

  useEffect(() => {
    const sync = () => setActiveId(peekUnlockGuide());
    sync();
    window.addEventListener(UNLOCK_GUIDE_CHANGED, sync);
    return () => window.removeEventListener(UNLOCK_GUIDE_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setPhase("point_open");
    setTabIndex(0);
  }, [activeId]);

  useEffect(() => {
    if (!activeId || !def) return;
    const id = window.setInterval(() => setPulse(p => (p + 1) % 60), 50);
    return () => window.clearInterval(id);
  }, [activeId, def]);

  useEffect(() => {
    if (!activeId || !def) {
      setHandPos(null);
      return;
    }

    const update = () => {
      if (phase === "point_open") {
        const r = targetRect(def.menuTarget);
        if (!r) { setHandPos(null); return; }
        setHandPos({ x: r.left + r.width * 0.85, y: r.top + r.height * 0.5, rot: -135 });
        return;
      }
      if (phase === "point_tab" && def.tabs?.[tabIndex]) {
        const tabId = def.tabs[tabIndex].tabId;
        const r = targetRect(`customTab-${tabId}`);
        if (!r) { setHandPos(null); return; }
        setHandPos({ x: r.left + r.width / 2, y: r.bottom + 12, rot: -90 });
        return;
      }
      setHandPos(null);
    };

    update();
    const id = window.setInterval(update, 180);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [activeId, def, phase, tabIndex]);

  useEffect(() => {
    if (!activeId || !def) return;

    if (phase === "point_open") {
      if (def.screenAfterOpen && screen === def.screenAfterOpen) {
        if (def.tabs?.length) {
          setPhase("point_tab");
          setTabIndex(0);
          onRequestCustomizationTab?.(def.tabs[0].tabId);
        } else {
          setPhase("explain");
        }
      }
      return;
    }

    if (phase === "point_tab" && def.tabs?.[tabIndex]) {
      if (screen === "customization" && customizationTab === def.tabs[tabIndex].tabId) {
        setPhase("explain_tab");
      }
      return;
    }

    if (phase === "explain" || phase === "explain_tab") {
      const timer = window.setTimeout(() => {
        if (phase === "explain_tab" && def.tabs && tabIndex < def.tabs.length - 1) {
          const next = tabIndex + 1;
          setTabIndex(next);
          setPhase("point_tab");
          onRequestCustomizationTab?.(def.tabs[next].tabId);
          return;
        }
        completeUnlockGuideFeature(activeId);
        setActiveId(peekUnlockGuide());
      }, phase === "explain_tab" ? 4500 : 4000);
      return () => window.clearTimeout(timer);
    }
  }, [activeId, def, phase, screen, customizationTab, tabIndex, onRequestCustomizationTab]);

  if (!activeId || !def) return null;

  const guideScreens = new Set([
    "menu", "modeSelect", "customization", "clashpass", "pets", "starFeats",
    "clubs", "battleFeed", "rankedMenu", "playerMapEditorModeSelect",
  ]);
  if (!guideScreens.has(screen) && phase !== "explain" && phase !== "explain_tab") return null;

  let messageKey = def.openMessageKey;
  if (phase === "explain") messageKey = def.explainMessageKey;
  if ((phase === "point_tab" || phase === "explain_tab") && def.tabs?.[tabIndex]) {
    messageKey = phase === "point_tab"
      ? def.tabs[tabIndex].openMessageKey
      : def.tabs[tabIndex].explainMessageKey;
  }

  const bounce = handPos ? (Math.sin((pulse / 60) * Math.PI * 2) + 1) / 2 : 0;

  return (
    <>
      {(phase === "point_open" || phase === "point_tab") && handPos && (
        <img
          src={HAND_SRC}
          alt=""
          draggable={false}
          className="ui-game-icon"
          style={{
            position: "fixed",
            left: handPos.x + bounce * 6,
            top: handPos.y + bounce * 4,
            width: 76,
            height: "auto",
            transform: `rotate(${handPos.rot}deg) scale(${1 + bounce * 0.06})`,
            transformOrigin: "70% 85%",
            zIndex: 8500,
            pointerEvents: "none",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.65))",
          }}
        />
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: 8400, pointerEvents: "none" }}>
        <TutorialAstralBubble messageId={messageKey} messageText={t(messageKey)} />
      </div>
    </>
  );
}
