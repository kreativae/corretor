import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { buildGoogleAuthUrl, requestPublicOrigin } from "@/lib/google";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const origin = requestPublicOrigin(req);
  const integrationId = url.searchParams.get("integrationId");
  if (!integrationId) {
    return NextResponse.redirect(
      new URL("/admin/configuracoes?error=missing_integration", origin),
    );
  }

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId));

  if (
    !integration ||
    integration.category !== "google" ||
    !integration.clientId ||
    !integration.clientSecret
  ) {
    return NextResponse.redirect(
      new URL("/admin/configuracoes?error=google_credentials", origin),
    );
  }

  const state = randomBytes(24).toString("hex");
  const authUrl = buildGoogleAuthUrl(integration, origin, state);
  const res = NextResponse.redirect(authUrl);
  res.cookies.set(
    "imob_google_oauth",
    Buffer.from(JSON.stringify({ state, integrationId })).toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    },
  );
  return res;
}
