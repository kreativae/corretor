import { db } from "@/db";
import { activities, integrations } from "@/db/schema";
import {
  exchangeGoogleCode,
  getGoogleUserEmail,
  GOOGLE_SCOPES,
  requestPublicOrigin,
} from "@/lib/google";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const origin = requestPublicOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const rawCookie = req.cookies.get("imob_google_oauth")?.value;

  const fail = (reason: string) => {
    const target = new URL("/admin/configuracoes", origin);
    target.searchParams.set("error", reason);
    const res = NextResponse.redirect(target);
    res.cookies.delete("imob_google_oauth");
    return res;
  };

  if (oauthError) return fail(oauthError);
  if (!code || !state || !rawCookie) return fail("invalid_oauth_response");

  try {
    const saved = JSON.parse(
      Buffer.from(rawCookie, "base64url").toString("utf8"),
    ) as { state: string; integrationId: string };
    if (saved.state !== state) return fail("invalid_state");

    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, saved.integrationId));
    if (!integration) return fail("integration_not_found");

    const token = await exchangeGoogleCode(integration, code, origin);
    const email = await getGoogleUserEmail(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    await db
      .update(integrations)
      .set({
        connected: true,
        accountEmail: email ?? integration.accountEmail,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? integration.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: GOOGLE_SCOPES[integration.provider] ?? integration.scopes,
        syncCursor: null,
        statusMessage: "Conta autorizada pelo Google OAuth 2.0.",
      })
      .where(eq(integrations.id, integration.id));

    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "sync",
      text: `${integration.name} conectado à conta ${email ?? "Google"} via OAuth 2.0.`,
    });

    const target = new URL("/admin/configuracoes", origin);
    target.searchParams.set("connected", integration.provider);
    const res = NextResponse.redirect(target);
    res.cookies.delete("imob_google_oauth");
    return res;
  } catch (e) {
    console.error(e);
    return fail("token_exchange_failed");
  }
}
