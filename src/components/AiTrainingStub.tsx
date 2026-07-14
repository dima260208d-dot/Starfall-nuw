import { useEffect, useState } from "react";
import LoadingScreen from "../pages/LoadingScreen";
import AiTrainingInfoPanel from "./AiTrainingInfoPanel";
import { startAiBattleTraining, subscribeTrainingProgress } from "../ai/aiTrainingRuntime";
import { getTrainingProgress, type TrainingProgress } from "../ai/aiTrainingStore";

/** Loading-screen backdrop + training info panel + headless cycles only. */
export default function AiTrainingStub({ onReady }: { onReady: () => void }) {
  const [p, setP] = useState<TrainingProgress>(() => getTrainingProgress());

  useEffect(() => {
    startAiBattleTraining();
    return subscribeTrainingProgress(setP);
  }, []);

  const progress = Math.min(1, p.totalCycles / Math.max(1, p.targetCycles));

  return (
    <>
      <LoadingScreen
        label="Обучение ботов"
        progress={progress}
        duration={800}
        onDone={onReady}
      />
      <AiTrainingInfoPanel progress={p} />
    </>
  );
}
