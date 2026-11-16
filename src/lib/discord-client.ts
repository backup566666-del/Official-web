import type { User } from "firebase/auth";
import type { BotSyncStatus } from "./firebase";

const API_ORIGIN = (import.meta.env["VITE_DISCORD_API_ORIGIN"] as string | undefined)?.trim().replace(/\/+$/, "") ?? "";

function apiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

async function authedJsonRequest<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const idToken = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${idToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok) {
    const errMsg = typeof data["error"] === "string" ? data["error"] : `Request failed (${res.status}).`;
    throw new Error(errMsg);
  }

  return data as T;
}

export async function startDiscordOAuth(user: User): Promise<{ url: string; redirectUri: string }> {
  return authedJsonRequest<{ ok: true; url: string; redirectUri: string }>(user, "/api/discord/start", {
    method: "POST",
    body: JSON.stringify({ origin: window.location.origin }),
  });
}

export async function completeDiscordOAuth(
  user: User,
  code: string,
  state: string,
): Promise<{ ok: true; botSyncStatus: BotSyncStatus; message?: string }> {
  return authedJsonRequest(user, "/api/discord/complete", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });
}

export async function syncDiscordConnection(
  user: User,
): Promise<{ ok: true; botSyncStatus: BotSyncStatus; message?: string }> {
  return authedJsonRequest(user, "/api/discord/sync", {
    method: "POST",
  });
}

export async function disconnectDiscordAccount(user: User): Promise<{ ok: true }> {
  return authedJsonRequest(user, "/api/discord/disconnect", {
    method: "POST",
  });
}

export type IntegrationStatusResponse = {
  botApiConfigured: boolean;
  botApiHost: string | null;
  botApiReachable: boolean | null;
  botApiStatusCode: number | null;
  botApiMessage: string;
  oauthConfigured: boolean;
  guildConfigured: boolean;
  firestoreAdminConfigured: boolean;
};

export async function fetchIntegrationStatus(user: User, probe = false): Promise<IntegrationStatusResponse> {
  const suffix = probe ? "?probe=1" : "";
  return authedJsonRequest<IntegrationStatusResponse>(user, `/api/integration/status${suffix}`, {
    method: "GET",
  });
}
