/** Admin ↔ config-server AI training control. */
import { adminConfigHeaders, getConfigBaseUrl } from "../adminDesktop/configServerAuth";

export type ServerTrainingStatus = {
  running: boolean;
  totalCycles: number;
  targetCycles: number;
  blueWins: number;
  redWins: number;
  timeouts: number;
  complete: boolean;
  cyclesPerSec: number;
  completedTracks: number;
  totalTracks: number;
  tracks: Array<{
    id: string;
    label: string;
    category: string;
    cycles: number;
    target: number;
    pct: number;
    complete: boolean;
  }>;
  tuning: {
    engageBias: number;
    objectiveBias: number;
    retreatBias: number;
    flankBias: number;
    superBias: number;
  };
  lastBatchAt: number;
  published?: boolean;
};

function adminHeaders(): Record<string, string> {
  return adminConfigHeaders();
}

export async function fetchServerTrainingStatus(): Promise<ServerTrainingStatus | null> {
  try {
    const base = getConfigBaseUrl().replace(/\/$/, "");
    const res = await fetch(`${base}/admin/ai-training/status`, {
      headers: adminHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerTrainingStatus;
  } catch {
    return null;
  }
}

export async function controlServerAiTraining(
  action: "start" | "stop" | "force100",
): Promise<ServerTrainingStatus | null> {
  try {
    const base = getConfigBaseUrl().replace(/\/$/, "");
    const res = await fetch(`${base}/admin/ai-training/control`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerTrainingStatus;
  } catch {
    return null;
  }
}
