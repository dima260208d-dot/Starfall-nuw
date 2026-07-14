export type TrainingControlState = "running" | "stopped";

const CONTROL_KEY = "ai_training_control_v1";
const CONTROL_EVENT = "ai-training-control";

export function getTrainingControlState(): TrainingControlState {
  try {
    return localStorage.getItem(CONTROL_KEY) === "running" ? "running" : "stopped";
  } catch {
    return "stopped";
  }
}

export function setTrainingControlState(state: TrainingControlState): void {
  try {
    localStorage.setItem(CONTROL_KEY, state);
  } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(CONTROL_EVENT, { detail: state }));
}

export function subscribeTrainingControl(cb: (state: TrainingControlState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<TrainingControlState>).detail);
  window.addEventListener(CONTROL_EVENT, handler);
  cb(getTrainingControlState());
  return () => window.removeEventListener(CONTROL_EVENT, handler);
}

export function isAiTrainingRunning(): boolean {
  return getTrainingControlState() === "running";
}
