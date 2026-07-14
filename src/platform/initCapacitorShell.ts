import { isCapacitorNativeApp } from "./capacitorEnv";
import { gameMusic } from "../audio/gameMusicService";

/** Hide status bar chrome and lock immersive fullscreen on native Android. */
export async function initCapacitorShell(): Promise<void> {
  if (!isCapacitorNativeApp()) return;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.hide();

    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();

    const { App } = await import("@capacitor/app");
    // Pause (don't stop) so the current track — e.g. battle music — resumes when
    // the app returns to the foreground. `stop()` nulls the desired track, which
    // made in-battle music vanish after any transient app-state blip.
    void App.addListener("pause", () => gameMusic.pauseAll());
    void App.addListener("resume", () => gameMusic.ensurePlaying());
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) gameMusic.ensurePlaying();
      else gameMusic.pauseAll();
    });
  } catch (err) {
    console.warn("[capacitor] shell init", err);
  }
}
