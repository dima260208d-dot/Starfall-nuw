import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const buildUrl = viteEnv.VITE_SUPABASE_URL;
const buildAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

let runtimeUrl: string | undefined;
let runtimeAnonKey: string | undefined;
let client: SupabaseClient | null = null;

function resolveUrl(): string | undefined {
  return buildUrl || runtimeUrl;
}

function resolveAnonKey(): string | undefined {
  return buildAnonKey || runtimeAnonKey;
}

export function applySupabaseRuntimeConfig(url: string, anonKey: string): void {
  runtimeUrl = url;
  runtimeAnonKey = anonKey;
  client = null;
}

export function isSupabaseConfigured(): boolean {
  const url = resolveUrl();
  const anonKey = resolveAnonKey();
  return Boolean(url && anonKey && url.includes("supabase.co"));
}

export function getSupabaseConfigHint(): string | null {
  const url = resolveUrl();
  const anonKey = resolveAnonKey();
  if (!url && !buildUrl) return "VITE_SUPABASE_URL missing (add .env.local or public/cloud-config.json)";
  if (!anonKey && !buildAnonKey) return "VITE_SUPABASE_ANON_KEY missing (add .env.local or public/cloud-config.json)";
  if (!url?.includes("supabase.co")) return "VITE_SUPABASE_URL invalid";
  return null;
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const url = resolveUrl()!;
  const anonKey = resolveAnonKey()!;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
