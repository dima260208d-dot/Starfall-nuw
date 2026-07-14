import { createRoot } from "react-dom/client";
import AppShell from "./AppShell";
import "./platform/contentProtection";
import "./utils/devWebGLRecovery";
import "./index.css";
import "./uiVolumetric.css";
import "./uiVolProgress.css";
import "./utils/brawlerDisplay";
import { autoSeedDefaultMaps } from "./utils/mapEditorAPI";
import { seedCuratedMaps } from "./utils/curatedMapSeed";
import { I18nProvider } from "./i18n";
import { PlatformLayoutProvider, initCapacitorShell } from "./platform";
import { loadCloudRuntimeConfig } from "./lib/runtimeConfig";
import { initAssetDiskCache } from "./utils/assetDiskCache";
import { initLiveConfig } from "./lib/liveConfig";
import { getHeavyAssetBaseUrl, resolvePublicAssetUrl } from "./lib/assetBase";
import { setRenderersBase } from "./game/miyaTopDownRenderer";
import { preloadAllGameAudio } from "./audio/gameAudioPreload";
import { preloadBootIntroVideos } from "./utils/firstLaunchIntro";
import { installUiImageRetry } from "./utils/uiImageRetry";

autoSeedDefaultMaps();
seedCuratedMaps();

function renderApp(): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  createRoot(rootEl).render(
    <I18nProvider>
      <PlatformLayoutProvider>
        <AppShell />
      </PlatformLayoutProvider>
    </I18nProvider>,
  );
}

async function boot(): Promise<void> {
  try {
    void initCapacitorShell();
    installUiImageRetry();
    preloadBootIntroVideos();
    preloadAllGameAudio();
    for (const bg of [
      "main-menu-bg.png", "loading-battle.png", "shop-bg.png", "modeselect-bg.png",
      "profile-bg.png", "collection-bg.png", "clashpass-bg.png",
    ]) {
      const img = new Image();
      img.src = resolvePublicAssetUrl(bg);
    }
    await initAssetDiskCache();
    await loadCloudRuntimeConfig();
    initLiveConfig();
    const assetBase = getHeavyAssetBaseUrl();
    setRenderersBase(assetBase.replace(/\/$/, ""));

    const { preloadCustomizationAssets } = await import("./utils/customizationAssetPreload");
    preloadCustomizationAssets();

    // Show UI immediately — never block first paint on CDN voice manifest.
    renderApp();

    void import("./audio/voiceLineService")
      .then(({ preloadVoiceManifest }) => preloadVoiceManifest())
      .catch(() => {});

    const { initProfileCloudListeners } = await import("./utils/cloud/profileCloud");
    const { initAccountCloudListeners } = await import("./utils/cloud/accountCloud");
    const { initPartyServerBootstrap } = await import("./utils/cloud/partyServerBootstrap");
    const { initPresenceServerBootstrap } = await import("./utils/cloud/presenceServerBootstrap");
    const { initFriendServerBootstrap } = await import("./utils/cloud/friendServerBootstrap");
    const { purgeTestFriendsFromCurrentUser } = await import("./utils/social/seedTestFriends");
    const { bootstrapClubsCloud } = await import("./utils/clubCloudSync");
    initProfileCloudListeners();
    preloadCustomizationAssets();
    initAccountCloudListeners();
    initPartyServerBootstrap();
    initPresenceServerBootstrap();
    initFriendServerBootstrap();
    bootstrapClubsCloud();
    purgeTestFriendsFromCurrentUser();
  } catch (err) {
    console.error("[boot] failed", err);
    renderApp();
  }
}

void boot();
