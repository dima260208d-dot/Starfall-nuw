import { useEffect, useState } from "react";
import { getUiAssetBaseUrl } from "../../lib/assetBase";
import TutorialAstralBubble from "../tutorial/TutorialAstralBubble";
import {
  POST_BATTLE_GUIDE_CHANGED,
  getPostBattleGuideStep,
  isPostBattleGuideActive,
  advancePostBattleGuide,
  completePostBattleGuide,
  type PostBattleGuideStep,
} from "../../utils/tutorial/onboardingTutorial";
import { useI18n } from "../../i18n/I18nProvider";

const HAND_SRC = `${getUiAssetBaseUrl()}ui/tutorial-hand-pointer.png`;

const STEP_MESSAGE: Record<Exclude<PostBattleGuideStep, "done">, string> = {
  open_character_menu: "tutorial.postBattle.openCharacter",
  select_hana: "tutorial.postBattle.selectHana",
  upgrade_hana: "tutorial.postBattle.upgradeHana",
  celebrate: "tutorial.postBattle.stronger",
};

interface Props {
  screen: string;
  onComplete: () => void;
}

function targetRect(target: string): DOMRect | null {
  const el = document.querySelector(`[data-onboarding-target="${target}"]`);
  return el?.getBoundingClientRect() ?? null;
}

function targetForStep(step: PostBattleGuideStep): string | null {
  switch (step) {
    case "open_character_menu": return "character";
    case "select_hana": return "brawler-hana";
    case "upgrade_hana": return "upgrade-brawler";
    default: return null;
  }
}

export default function TutorialPostBattleOverlay({ screen, onComplete }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(() => isPostBattleGuideActive());
  const [step, setStep] = useState<PostBattleGuideStep>(() => getPostBattleGuideStep());
  const [handPos, setHandPos] = useState<{ x: number; y: number; rot: number } | null>(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const sync = () => {
      setActive(isPostBattleGuideActive());
      setStep(getPostBattleGuideStep());
    };
    sync();
    window.addEventListener(POST_BATTLE_GUIDE_CHANGED, sync);
    return () => window.removeEventListener(POST_BATTLE_GUIDE_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!active || step !== "open_character_menu") return;
    if (screen === "characterSelect") {
      advancePostBattleGuide("select_hana");
    }
  }, [active, step, screen]);

  useEffect(() => {
    if (!active || step !== "celebrate") return;
    const id = window.setTimeout(() => {
      completePostBattleGuide();
      onComplete();
    }, 4800);
    return () => window.clearTimeout(id);
  }, [active, step, onComplete]);

  useEffect(() => {
    if (!active || step === "celebrate" || step === "done") return;
    const id = window.setInterval(() => setPulse(p => (p + 1) % 60), 50);
    return () => window.clearInterval(id);
  }, [active, step]);

  useEffect(() => {
    if (!active || step === "celebrate" || step === "done") {
      setHandPos(null);
      return;
    }
    const target = targetForStep(step);
    if (!target) {
      setHandPos(null);
      return;
    }
    const update = () => {
      const r = targetRect(target);
      if (!r) {
        setHandPos(null);
        return;
      }
      setHandPos({
        x: r.left + r.width * 0.88,
        y: r.top + r.height * 0.45,
        rot: step === "upgrade_hana" ? -125 : -140,
      });
    };
    update();
    const id = window.setInterval(update, 160);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [active, step]);

  if (!active || step === "done") return null;

  const messageId = STEP_MESSAGE[step as Exclude<PostBattleGuideStep, "done">];
  const bounce = handPos ? (Math.sin((pulse / 60) * Math.PI * 2) + 1) / 2 : 0;
  const showHand = step !== "celebrate" && handPos;

  return (
    <>
      {showHand && (
        <img
          src={HAND_SRC}
          alt=""
          draggable={false}
          className="ui-game-icon"
          style={{
            position: "fixed",
            left: handPos.x + bounce * 8,
            top: handPos.y + bounce * 5,
            width: 76,
            height: "auto",
            transform: `rotate(${handPos.rot}deg) scale(${1 + bounce * 0.06})`,
            transformOrigin: "70% 85%",
            zIndex: 8600,
            pointerEvents: "none",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.65))",
          }}
        />
      )}
      <div style={{ position: "fixed", inset: 0, zIndex: 8550, pointerEvents: "none" }}>
        <TutorialAstralBubble messageId={messageId} messageText={t(messageId)} />
      </div>
    </>
  );
}

/** Call from CharacterSelect when the player opens Hana during the guide. */
export function notifyPostBattleHanaOpened(): void {
  if (!isPostBattleGuideActive()) return;
  if (getPostBattleGuideStep() !== "select_hana") return;
  advancePostBattleGuide("upgrade_hana");
}

/** Call after a successful Hana upgrade during the guide. */
export function notifyPostBattleHanaUpgraded(): void {
  if (!isPostBattleGuideActive()) return;
  if (getPostBattleGuideStep() !== "upgrade_hana") return;
  advancePostBattleGuide("celebrate");
}
