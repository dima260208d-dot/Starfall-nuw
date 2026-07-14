const LS = { url: "sf_cfg_url", tok: "sf_cfg_tok", gate: "sf_cfg_gate" };

export function getConfigBaseUrl(): string {
  return localStorage.getItem(LS.url) || "http://217.60.245.116/cfg";
}

export function getConfigToken(): string | null {
  return localStorage.getItem(LS.tok) || null;
}

export function getConfigGate(): string {
  return localStorage.getItem(LS.gate) || "";
}

/** Headers for authenticated admin API calls (config-server). */
export function adminConfigHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const tok = getConfigToken();
  const gate = getConfigGate();
  return {
    "content-type": "application/json",
    ...(tok ? { authorization: `Bearer ${tok}`, "x-admin-token": tok } : {}),
    ...(gate ? { "x-admin-gate": gate } : {}),
    ...extra,
  };
}

export function saveConfigSession(baseUrl: string, gate: string, token: string) {
  localStorage.setItem(LS.url, baseUrl);
  localStorage.setItem(LS.gate, gate);
  localStorage.setItem(LS.tok, token);
}

export function clearConfigSession() {
  localStorage.removeItem(LS.tok);
}

export async function pingConfigServer(baseUrl = getConfigBaseUrl()): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/healthz`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loginConfigServer(
  baseUrl: string,
  gate: string,
  password: string,
): Promise<void> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (gate) headers["x-admin-gate"] = gate;
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error("network");
  }
  if (res.status === 404) throw new Error("gate");
  if (res.status === 401) throw new Error("password");
  if (res.status === 429) throw new Error("rate");
  if (!res.ok) throw new Error("unknown");
  const { token } = await res.json();
  saveConfigSession(baseUrl, gate, token);
}
