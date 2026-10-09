import { db } from "@/db";
import { activities, integrations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { syncGoogleIntegration } from "@/lib/google-sync";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** Atualiza credenciais / preferências da integração. */
export async function PATCH(req: Request, { params }: Params) {
  await requireAdmin();
  try {
    const { id } = await params;
    const body = await req.json();

    const patch: Partial<typeof integrations.$inferInsert> = {};
    if (body.clientId !== undefined) patch.clientId = body.clientId || null;
    if (body.clientSecret !== undefined && body.clientSecret !== "") {
      patch.clientSecret = body.clientSecret;
    }
    if (body.accountEmail !== undefined)
      patch.accountEmail = body.accountEmail || null;
    if (typeof body.autoSync === "boolean") patch.autoSync = body.autoSync;
    if (typeof body.syncIntervalMin === "number")
      patch.syncIntervalMin = Math.max(5, body.syncIntervalMin);
    if (body.calendarId !== undefined)
      patch.calendarId = body.calendarId.trim() || "primary";
    if (Array.isArray(body.scopes)) patch.scopes = body.scopes;

    const [updated] = await db
      .update(integrations)
      .set(patch)
      .where(eq(integrations.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar integração" }, { status: 500 });
  }
}

/** Ações: disconnect | sync. Google connect ocorre via rota OAuth GET. */
export async function POST(req: Request, { params }: Params) {
  await requireAdmin();
  try {
    const { id } = await params;
    const { action } = await req.json();

    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id));
    if (!integration) {
      return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
    }

    if (action === "disconnect") {
      const [updated] = await db
        .update(integrations)
        .set({
          connected: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          syncCursor: null,
          accountEmail: null,
          autoSync: false,
          statusMessage: "Desconectado pelo administrador.",
        })
        .where(eq(integrations.id, id))
        .returning();
      await db.insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "sync",
        text: `Integração ${integration.name} desconectada.`,
      });
      return NextResponse.json(updated);
    }

    if (action === "connect") {
      return NextResponse.json(
        {
          error:
            integration.category === "google"
              ? "Use o fluxo OAuth do Google para conectar esta conta."
              : "Conexão deste provedor ainda não está disponível.",
        },
        { status: 400 },
      );
    }

    if (action === "sync") {
      if (!integration.connected) {
        return NextResponse.json(
          { error: "Conecte a integração antes de sincronizar." },
          { status: 400 },
        );
      }
      if (integration.category !== "google") {
        return NextResponse.json(
          { error: "Sincronização real disponível para Google Contacts e Calendar." },
          { status: 400 },
        );
      }

      const result = await syncGoogleIntegration(integration);
      return NextResponse.json({
        ok: result.errors.length === 0,
        lastSyncCount: result.pulled + result.pushed + result.unchanged,
        ...result,
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Falha na operação";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
