import { IntegrationsClient } from "@/components/admin/integrations-client";
import { FeaturesCard } from "@/components/admin/features-card";
import { StatCardsCard } from "@/components/admin/stat-cards-card";
import { MapOptionsCard } from "@/components/admin/map-options-card";
import { WatermarkCard } from "@/components/admin/watermark-card";
import { NotificationsCard } from "@/components/admin/notifications-card";
import { getFeatures, getMapOptions, getMessages, getStatCards, getWatermarkSettings } from "@/lib/features";
import { MessagesCard } from "@/components/admin/messages-card";
import { WhatsAppCard } from "@/components/admin/whatsapp-card";
import { WhiteLabelCard } from "@/components/admin/white-label-card";
import { emailConfigured, getNotifySettings } from "@/lib/notify";
import { db } from "@/db";
import { apiKeys, integrations } from "@/db/schema";
import { ensureGoogleIntegrations } from "@/lib/google";
import { getWhiteLabel, listActivities } from "@/lib/queries";
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
  const [notify, features, statCards, mapOptions, watermark, audit, messages] = await Promise.all([
    getNotifySettings(),
    getFeatures(),
    getStatCards(),
    getMapOptions(),
    getWatermarkSettings(true),
    listActivities(40),
    getMessages(),
  ]);

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
      <StatCardsCard initial={statCards} />
      <MapOptionsCard initial={mapOptions} />
      <WatermarkCard initial={watermark} />
      <NotificationsCard
        initialEmails={notify.leadEmails}
        initialEnabled={notify.enabled}
        fallbackEmail={wl.email}
        configured={await emailConfigured()}
      />
      <WhatsAppCard />
      <MessagesCard initial={messages} />
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
        audit={audit}
      />
    </div>
  );
}
