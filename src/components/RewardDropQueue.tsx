import { useEffect, useState } from "react";
import RewardDropModal, { type RewardInfo } from "./RewardDropModal";

interface Props {
  rewards: RewardInfo[];
  onDone: () => void;
}

/** Shows RewardDropModal for each reward in sequence. */
export default function RewardDropQueue({ rewards, onDone }: Props) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (rewards.length === 0) onDone();
  }, [rewards.length, onDone]);
  if (rewards.length === 0) return null;
  const reward = rewards[Math.min(index, rewards.length - 1)];
  return (
    <RewardDropModal
      reward={reward}
      onDone={() => {
        if (index + 1 >= rewards.length) onDone();
        else setIndex(index + 1);
      }}
    />
  );
}
