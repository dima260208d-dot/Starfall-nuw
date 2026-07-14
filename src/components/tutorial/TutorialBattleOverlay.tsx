import { useEffect, useRef, useState } from "react";
import {
  isTutorialStepComplete,
  nextTutorialStep,
  type TutorialSignals,
  type TutorialStep,
} from "../../utils/tutorial/onboardingTutorial";
import TutorialAstralBubble from "./TutorialAstralBubble";
import TutorialHandHint, { type TutorialStickTarget } from "./TutorialHandHint";
import { Tr } from "../../i18n/Tr";

const STEP_MESSAGE: Record<TutorialStep, string> = {
  move: "tutorial.step.move",
  auto_attack: "tutorial.step.autoAttack",
  aim_attack: "tutorial.step.aimAttack",
  charge_super: "tutorial.step.chargeSuper",
  use_super: "tutorial.step.useSuper",
  done: "tutorial.step.done",
};

interface Props {
  getSignals: () => TutorialSignals;
  onComplete: () => void;
  onSkipToLogin: () => void;
  /** Same condition as MobileControls visibility in GameScreen. */
  joysticksVisible: boolean;
  onBannerHeight?: (height: number) => void;
}

function handStickForStep(step: TutorialStep): TutorialStickTarget | null {
  if (step === "move") return "move";
  if (step === "auto_attack" || step === "aim_attack") return "attack";
  if (step === "use_super") return "super";
  return null;
}

export default function TutorialBattleOverlay({
  getSignals,
  onComplete,
  onSkipToLogin,
  joysticksVisible,
  onBannerHeight,
}: Props) {
  const [step, setStep] = useState<TutorialStep>("move");
  const completeRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (completeRef.current || step === "done") return;
      const signals = getSignals();
      if (!isTutorialStepComplete(step, signals)) return;
      const next = nextTutorialStep(step);
      if (next === "done") {
        completeRef.current = true;
        window.setTimeout(onComplete, 900);
      }
      setStep(next);
    }, 120);
    return () => window.clearInterval(id);
  }, [step, getSignals, onComplete]);

  const handStick = joysticksVisible ? handStickForStep(step) : null;

  return (
    <>
      <button
        type="button"
        onClick={onSkipToLogin}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 22,
          pointerEvents: "auto",
          background: "linear-gradient(135deg, rgba(74,20,140,0.92), rgba(26,0,51,0.92))",
          border: "1.5px solid rgba(206,147,216,0.65)",
          borderRadius: 12,
          padding: "8px 14px",
          color: "#fff",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
        }}
      >
        <Tr id="tutorial.signIn" />
      </button>

      {step !== "done" && (
        <TutorialAstralBubble messageId={STEP_MESSAGE[step]} onSizeChange={onBannerHeight} />
      )}

      {handStick && (
        <TutorialHandHint stick={handStick} visible />
      )}
    </>
  );
}
