import { getCurrentUser } from "@/lib/auth";
import { getEmailConfig } from "@/lib/notify";
import { isAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

type DomainRecord = { record: string; name: string; type: string; value: string; status: string };
type Domain = {
  id: string;
  name: string;
  status: string;
  capabilities?: { sending?: string; receiving?: string };
  open_tracking?: boolean;
  click_tracking?: boolean;
  records?: DomainRecord[];
};

async function resend(path: string, key: string) {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

/**
 * Confere no Resend o que a caixa de e-mail precisa: chave com acesso total, domínio
 * do remetente verificado (envio e recebimento) e rastreamento desligado.
 */
export async function POST() {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  const cfg = await getEmailConfig();
  if (!cfg.resendApiKey) return NextResponse.json({ error: "Informe a API Key do Resend e salve." }, { status: 400 });
  const domainName = cfg.fromEmail.split("@")[1]?.toLowerCase() ?? "";

  // Chave "Sending access" não lista domínios nem lê e-mails recebidos
  const list = await resend("/domains", cfg.resendApiKey);
  if (!list.ok) {
    const restricted = list.status === 401 || list.status === 403 || list.data?.name === "restricted_api_key";
    return NextResponse.json({
      fullAccess: false,
      error: restricted
        ? "A chave só tem permissão de envio. Para a caixa de e-mail, crie uma chave com “Full access”."
        : list.data?.message || `Resend: HTTP ${list.status}`,
    });
  }

  const found = (list.data?.data as Domain[] | undefined)?.find((d) => d.name.toLowerCase() === domainName);
  let domain: Domain | null = null;
  if (found) {
    const one = await resend(`/domains/${found.id}`, cfg.resendApiKey);
    domain = one.ok ? (one.data as Domain) : found;
  }
  const receiving = await resend("/emails/receiving?limit=1", cfg.resendApiKey);

  return NextResponse.json({
    fullAccess: true,
    readReceived: receiving.ok,
    domainName,
    domain: domain && {
      status: domain.status,
      sending: domain.capabilities?.sending ?? null,
      receiving: domain.capabilities?.receiving ?? null,
      openTracking: !!domain.open_tracking,
      clickTracking: !!domain.click_tracking,
      records: (domain.records ?? []).map((r) => ({
        record: r.record,
        type: r.type,
        name: r.name,
        status: r.status,
      })),
    },
  });
}
