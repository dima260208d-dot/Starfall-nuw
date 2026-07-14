/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAPACITOR_BUILD?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GAME_SERVER_URL?: string;
  readonly VITE_ASSET_CDN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
