import { IntegrationsClient } from "@/components/admin/integrations-client";
import { db } from "@/db";
import { apiKeys, integrations } from "@/db/schema";
import { getWhiteLabel } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const [ints, keys, wl] = await Promise.all([
    db.select().from(integrations).orderBy(integrations.name),
    db.select().from(apiKeys).orderBy(apiKeys.createdAt),
    getWhiteLabel(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Governança · Integrações
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Configurações
          </h1>
        </div>
        <p className="max-w-sm text-right text-xs leading-relaxed text-subtle">
          Tokens, chaves de API e conexões reais com Google Contacts e Google
          Calendar. Segredos permanecem exclusivamente no servidor.
        </p>
      </div>
      <IntegrationsClient
        integrations={ints.map((item) => ({
          id: item.id,
          provider: item.provider,
          name: item.name,
          category: item.category,
          connected: item.connected,
          accountEmail: item.accountEmail,
          clientId: item.clientId,
          scopes: item.scopes,
          autoSync: item.autoSync,
          syncIntervalMin: item.syncIntervalMin,
          lastSyncAt: item.lastSyncAt,
          lastSyncCount: item.lastSyncCount,
          statusMessage: item.statusMessage,
          calendarId: item.calendarId,
          hasClientSecret: !!item.clientSecret,
          hasAccessToken: !!item.accessToken,
          hasRefreshToken: !!item.refreshToken,
        }))}
        apiKeys={keys}
        whiteLabel={wl}
      />
    </div>
  );
}
