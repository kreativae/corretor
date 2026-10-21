import { WhatsAppInbox } from "@/components/crm/whatsapp-inbox";
import { getCurrentUser } from "@/lib/auth";
import { getWhatsAppConfig, lineFor, perUserLines, threadPhone, waPhone, whatsappReady } from "@/lib/whatsapp";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const [{ tel }, user, cfg] = await Promise.all([searchParams, getCurrentUser(), getWhatsAppConfig()]);
  // Abre a conversa que já existe, mesmo que o número do cadastro tenha (ou não) o 9
  const initialPhone = tel && user ? await threadPhone((await lineFor(user.id, cfg)).line, waPhone(tel)) : undefined;
  return (
    <div className="mx-auto max-w-[1920px]">
      <WhatsAppInbox
        ready={whatsappReady(cfg)}
        isAdmin={isAdmin(user)}
        initialPhone={initialPhone}
        hasTemplate={!!cfg.templateName}
        provider={cfg.provider}
        userName={user?.name ?? ""}
        ownNumber={perUserLines(cfg)}
      />
    </div>
  );
}
