import { IntegrationsClient } from "@/components/admin/integrations-client";
import { FeaturesCard } from "@/components/admin/features-card";
import { NotificationsCard } from "@/components/admin/notifications-card";
import { getFeatures } from "@/lib/features";
import { WhiteLabelCard } from "@/components/admin/white-label-card";
import { emailConfigured, getNotifySettings } from "@/lib/notify";
import { db } from "@/db";
import { apiKeys, integrations } from "@/db/schema";
import { ensureGoogleIntegrations } from "@/lib/google";
import { getWhiteLabel } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await ensureGoogleIntegrations();
  const [ints, keys, wl] = await Promise.all([
    db.select().from(integrations).orderBy(integrations.name),
    db.select().from(apiKeys).orderBy(apiKeys.createdAt),
    getWhiteLabel(),
  ]);
  const [notify, features] = await Promise.all([getNotifySettings(), getFeatures()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Governança · Marca e integrações
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Configurações
          </h1>
        </div>
        <p className="max-w-sm text-right text-xs leading-relaxed text-subtle">
          Identidade da marca, tokens, chaves de API e conexões com Google
          Contacts e Calendar. Segredos permanecem exclusivamente no servidor.
        </p>
      </div>
      <WhiteLabelCard initial={wl} />
      <FeaturesCard initial={features} />
      <NotificationsCard
        initialEmails={notify.leadEmails}
        fallbackEmail={wl.email}
        configured={emailConfigured()}
      />
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
