import { IntegrationsClient } from "@/components/admin/integrations-client";
import { PortalConnect } from "@/components/crm/portal-connect";
import { FeaturesCard } from "@/components/admin/features-card";
import { StatCardsCard } from "@/components/admin/stat-cards-card";
import { MapOptionsCard } from "@/components/admin/map-options-card";
import { WatermarkCard } from "@/components/admin/watermark-card";
import { SecurityCard } from "@/components/admin/security-card";
import { BadgesCard } from "@/components/admin/badges-card";
import { RemindersCard } from "@/components/admin/reminders-card";
import { getWhatsAppConfig, whatsappReady } from "@/lib/whatsapp";
import { getBadgeSettings, getReminderSettings, getFeatures, getMapOptions, getMessages, getSecuritySettings, getStatCards, getWatermarkSettings } from "@/lib/features";
import { MessagesCard } from "@/components/admin/messages-card";
import { WhatsAppCard } from "@/components/admin/whatsapp-card";
import { WhiteLabelCard } from "@/components/admin/white-label-card";
import { getDb } from "@/db";
import { apiKeys, integrations } from "@/db/schema";
import { ensureGoogleIntegrations } from "@/lib/google";
import { getWhiteLabel, listActivities } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await ensureGoogleIntegrations();
  const [ints, keys, wl] = await Promise.all([
    (await getDb()).select().from(integrations).orderBy(integrations.name),
    (await getDb()).select().from(apiKeys).orderBy(apiKeys.createdAt),
    getWhiteLabel(),
  ]);
  const [features, statCards, mapOptions, watermark, audit, messages, security, badges, reminders, waCfg] = await Promise.all([
    getFeatures(),
    getStatCards(),
    getMapOptions(),
    getWatermarkSettings(true),
    listActivities(40),
    getMessages(),
    getSecuritySettings(),
    getBadgeSettings(),
    getReminderSettings(),
    getWhatsAppConfig(),
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
      <SecurityCard initial={security} />
      <FeaturesCard initial={features} />
      <StatCardsCard initial={statCards} />
      <MapOptionsCard initial={mapOptions} />
      <WatermarkCard
        initial={watermark}
        logoHint={
          wl.logoDarkUrl || wl.logoUrl || wl.iconUrl
            ? "Logo da empresa (White label)"
            : wl.showMark
              ? "Símbolo padrão · Carlos Amâncio Imóveis"
              : "Nome da marca, como no menu (envie um logo no White label para trocar)"
        }
      />
      <BadgesCard initial={badges} />
      <WhatsAppCard />
      <RemindersCard initial={reminders} waReady={whatsappReady(waCfg)} />
      <MessagesCard initial={messages} />
      {/* Portais imobiliários: anúncios pelo feed XML e leads de volta para o CRM */}
      <section className="card-elev rounded-2xl border border-hairline bg-card p-5 md:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">Portais imobiliários</h2>
        <PortalConnect />
      </section>
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
