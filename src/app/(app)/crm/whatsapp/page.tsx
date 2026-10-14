import { WhatsAppInbox } from "@/components/crm/whatsapp-inbox";
import { getCurrentUser } from "@/lib/auth";
import { getWhatsAppConfig, waPhone, whatsappReady } from "@/lib/whatsapp";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const [{ tel }, user, cfg] = await Promise.all([searchParams, getCurrentUser(), getWhatsAppConfig()]);
  return (
    <div className="mx-auto max-w-6xl">
      <WhatsAppInbox
        ready={whatsappReady(cfg)}
        isAdmin={user?.role === "admin"}
        initialPhone={tel ? waPhone(tel) : undefined}
        hasTemplate={!!cfg.templateName}
        provider={cfg.provider}
      />
    </div>
  );
}
