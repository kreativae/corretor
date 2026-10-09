import "server-only";

import { db } from "@/db";
import { integrations, type Integration } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GOOGLE_SCOPES: Record<string, string[]> = {
  google_contacts: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/contacts",
  ],
  google_calendar: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events",
  ],
};

/** Garante que os cartões do Google existam (base sem seed). */
export async function ensureGoogleIntegrations() {
  await db
    .insert(integrations)
    .values([
      {
        provider: "google_contacts",
        name: "Google Contacts",
        category: "google",
        scopes: GOOGLE_SCOPES.google_contacts,
        syncIntervalMin: 30,
        statusMessage: "Configure as credenciais do Google Cloud e autorize a conta.",
      },
      {
        provider: "google_calendar",
        name: "Google Calendar",
        category: "google",
        calendarId: "primary",
        scopes: GOOGLE_SCOPES.google_calendar,
        syncIntervalMin: 15,
        statusMessage: "Configure as credenciais do Google Cloud e autorize a conta.",
      },
    ])
    .onConflictDoNothing({ target: integrations.provider });
}

export function requestPublicOrigin(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host") || new URL(req.url).host;
  const forwardedProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const localHost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0");
  const proto = localHost ? forwardedProto || "http" : "https";
  return `${proto}://${host}`;
}

export function googleRedirectUri(origin: string) {
  return `${origin}/api/integrations/google/callback`;
}

export function buildGoogleAuthUrl(
  integration: Integration,
  origin: string,
  state: string,
) {
  if (!integration.clientId) throw new Error("Client ID não configurado.");
  const scopes = GOOGLE_SCOPES[integration.provider];
  if (!scopes) throw new Error("Provedor Google inválido.");

  const params = new URLSearchParams({
    client_id: integration.clientId.trim(),
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (integration.accountEmail) params.set("login_hint", integration.accountEmail);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Falha ao obter token Google.");
  }
  return data as TokenResponse;
}

export async function exchangeGoogleCode(
  integration: Integration,
  code: string,
  origin: string,
) {
  if (!integration.clientId || !integration.clientSecret) {
    throw new Error("Credenciais OAuth incompletas.");
  }
  return tokenRequest(
    new URLSearchParams({
      code,
      client_id: integration.clientId.trim(),
      client_secret: integration.clientSecret.trim(),
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  );
}

/** Retorna access token válido e atualiza o banco se precisar renovar. */
export async function getGoogleAccessToken(integration: Integration) {
  const safeUntil = Date.now() + 60_000;
  if (
    integration.accessToken &&
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() > safeUntil
  ) {
    return integration.accessToken;
  }

  if (!integration.refreshToken || !integration.clientId || !integration.clientSecret) {
    throw new Error("Autorização Google expirada. Reconecte a conta.");
  }

  const token = await tokenRequest(
    new URLSearchParams({
      refresh_token: integration.refreshToken,
      client_id: integration.clientId.trim(),
      client_secret: integration.clientSecret.trim(),
      grant_type: "refresh_token",
    }),
  );

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  await db
    .update(integrations)
    .set({
      accessToken: token.access_token,
      tokenExpiresAt: expiresAt,
      connected: true,
      statusMessage: "Token de acesso renovado automaticamente.",
    })
    .where(eq(integrations.id, integration.id));

  return token.access_token;
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload: unknown,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export async function googleApi<T>(
  integration: Integration,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getGoogleAccessToken(integration);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.error?.message || data?.error_description || `Google API: HTTP ${res.status}`;
    throw new GoogleApiError(message, res.status, data);
  }
  return data as T;
}

export async function getGoogleUserEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}
