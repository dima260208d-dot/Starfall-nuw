const MUSIC_KEY = "starfall_music_enabled_v1";
const VOICE_KEY = "starfall_voice_enabled_v1";

export const BGM_RELATIVE_VOLUME = 0.2;
export const SFX_RELATIVE_VOLUME = 0.4;
export const VOICE_RELATIVE_VOLUME = 0.4;

function readBool(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    return raw === "1" || raw === "true";
  } catch {
    return defaultValue;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isMusicEnabled(): boolean {
  return readBool(MUSIC_KEY, true);
}

export function isVoiceEnabled(): boolean {
  return readBool(VOICE_KEY, true);
}

export function setMusicEnabled(on: boolean): void {
  writeBool(MUSIC_KEY, on);
  window.dispatchEvent(new CustomEvent("starfall:audio-settings"));
}

export function setVoiceEnabled(on: boolean): void {
  writeBool(VOICE_KEY, on);
  window.dispatchEvent(new CustomEvent("starfall:audio-settings"));
}

export function subscribeAudioSettings(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("starfall:audio-settings", handler);
  return () => window.removeEventListener("starfall:audio-settings", handler);
}
