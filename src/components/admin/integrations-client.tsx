"use client";

import { Badge, Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import type { ApiKey } from "@/db/schema";
import type { WhiteLabel } from "@/lib/queries";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Contact,
  Copy,
  KeyRound,
  Link2,
  Link2Off,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PROVIDER_ICONS: Record<string, typeof Contact> = {
  google_contacts: Contact,
  google_calendar: CalendarDays,
  whatsapp: MessageCircle,
};

const SCOPE_LABELS: Record<string, string> = {
  leitura: "Somente leitura",
  escrita: "Leitura e escrita",
  total: "Acesso total",
};

export type IntegrationView = {
  id: string;
  provider: string;
  name: string;
  category: "google" | "mensageria" | "portal" | "infra";
  connected: boolean;
  accountEmail: string | null;
  clientId: string | null;
  scopes: string[];
  autoSync: boolean;
  syncIntervalMin: number;
  lastSyncAt: Date | string | null;
  lastSyncCount: number;
  statusMessage: string | null;
  calendarId: string;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
};

function Copyable({ text, mono = true }: { text: string; mono?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-soft px-3.5 py-2.5">
      <code
        className={cn(
          "min-w-0 flex-1 truncate text-xs text-subtle",
          mono && "font-mono",
        )}
      >
        {text}
      </code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
        className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-card hover:text-ink"
        aria-label="Copiar"
      >
        {ok ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function IntegrationCard({ item }: { item: IntegrationView }) {
  const router = useRouter();
  const Icon = PROVIDER_ICONS[item.provider] ?? Link2;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: item.clientId ?? "",
    clientSecret: "",
    accountEmail: item.accountEmail ?? "",
    syncIntervalMin: String(item.syncIntervalMin),
    calendarId: item.calendarId || "primary",
  });

  async function persistCredentials(showToast = true) {
    const res = await fetch(`/api/integrations/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        clientSecret: form.clientSecret,
        accountEmail: form.accountEmail,
        syncIntervalMin: Number(form.syncIntervalMin) || 60,
        calendarId: form.calendarId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erro ao salvar credenciais.");
    if (showToast) toast.success("Credenciais salvas no servidor.");
    return data;
  }

  async function saveCreds() {
    setBusy("save");
    try {
      await persistCredentials();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar credenciais.");
    } finally {
      setBusy(null);
    }
  }

  async function connectGoogle() {
    if (!form.clientId.trim() || (!item.hasClientSecret && !form.clientSecret.trim())) {
      toast.error("Informe o Client ID e o Client Secret do Google Cloud.");
      setOpen(true);
      return;
    }
    setBusy("connect");
    try {
      await persistCredentials(false);
      window.location.assign(
        `/api/integrations/google/connect?integrationId=${encodeURIComponent(item.id)}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar OAuth.");
      setBusy(null);
    }
  }

  async function act(action: "connect" | "disconnect" | "sync") {
    setBusy(action);
    try {
      const res = await fetch(`/api/integrations/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountEmail: form.accountEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        action === "connect"
          ? `${item.name} conectado com sucesso.`
          : action === "disconnect"
            ? `${item.name} desconectado.`
            : `${item.name}: ${data.pulled ?? 0} recebidos · ${data.pushed ?? 0} enviados${data.removed ? ` · ${data.removed} removidos` : ""}${data.errors?.length ? ` · ${data.errors.length} erros` : ""}.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleAuto(v: boolean) {
    await fetch(`/api/integrations/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSync: v }),
    });
    toast.success(v ? "Sincronização automática ativada." : "Sincronização automática desativada.");
    router.refresh();
  }

  return (
    <div className="card-elev rounded-2xl border border-hairline bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              item.connected
                ? "bg-accent/12 text-accent"
                : "bg-soft text-subtle",
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {item.name}
              {item.connected ? (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                  Conectado
                </Badge>
              ) : (
                <Badge>Desconectado</Badge>
              )}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-subtle">
              {item.accountEmail ?? "Nenhuma conta vinculada"}
              {item.lastSyncAt && ` · sync ${timeAgo(item.lastSyncAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.connected && (
            <Button
              size="sm"
              variant="outline"
              loading={busy === "sync"}
              onClick={() => act("sync")}
            >
              <RefreshCw className={cn("size-3.5", busy === "sync" && "animate-spin")} />
              Sincronizar
            </Button>
          )}
          {item.connected ? (
            <Button
              size="sm"
              variant="danger"
              loading={busy === "disconnect"}
              onClick={() => act("disconnect")}
            >
              <Link2Off className="size-3.5" />
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="accent"
              loading={busy === "connect"}
              onClick={item.category === "google" ? connectGoogle : () => act("connect")}
            >
              <Link2 className="size-3.5" />
              {item.category === "google" ? "Conectar com Google" : "Conectar"}
            </Button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Expandir"
            className="rounded-full p-2 text-subtle transition-colors hover:bg-soft hover:text-ink"
          >
            <ChevronDown
              className={cn("size-4 transition-transform duration-300", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-in space-y-4 border-t border-hairline p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client ID (OAuth 2.0)">
              <Input
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder="000000-xxxx.apps.googleusercontent.com"
                className="font-mono text-xs"
              />
            </Field>
            <Field
              label="Client Secret"
              hint={item.hasClientSecret ? "Já configurado — deixe vazio para manter" : undefined}
            >
              <Input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder={item.hasClientSecret ? "••••••••••••••••" : "GOCSPX-…"}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Conta preferencial" hint="O Google confirma a conta no consentimento OAuth">
              <Input
                value={form.accountEmail}
                onChange={(e) => setForm({ ...form, accountEmail: e.target.value })}
                placeholder="conta@gmail.com"
              />
            </Field>
            <Field label="Intervalo de sync (minutos)">
              <Input
                type="number"
                min={5}
                value={form.syncIntervalMin}
                onChange={(e) => setForm({ ...form, syncIntervalMin: e.target.value })}
                className="font-mono tabular"
              />
            </Field>
            {item.provider === "google_calendar" && (
              <Field label="ID do calendário" hint="Use “primary” para a agenda principal">
                <Input
                  value={form.calendarId}
                  onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>
            )}
          </div>

          {item.scopes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-subtle">Escopos solicitados</p>
              <div className="flex flex-wrap gap-1.5">
                {item.scopes.map((s) => (
                  <code
                    key={s}
                    className="rounded-md border border-hairline bg-soft px-2 py-1 font-mono text-[10px] text-subtle"
                  >
                    {s}
                  </code>
                ))}
              </div>
            </div>
          )}

          {item.hasRefreshToken && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-3 text-xs text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4 shrink-0" />
              Refresh token OAuth armazenado no servidor. O navegador nunca recebe o segredo.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3">
            <div>
              <p className="text-sm font-medium">Sincronização automática</p>
              <p className="text-[11px] text-subtle">
                A cada {item.syncIntervalMin} min, via endpoint de cron
              </p>
            </div>
            <Switch
              checked={item.autoSync}
              onChange={toggleAuto}
              disabled={!item.connected}
            />
          </div>

          {item.statusMessage && (
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">
              {item.statusMessage}
              {item.lastSyncAt && ` · ${formatDateTime(item.lastSyncAt)}`}
            </p>
          )}

          <div className="flex justify-end">
            <Button variant="primary" size="sm" loading={busy === "save"} onClick={saveCreds}>
              <Check className="size-3.5" />
              Salvar credenciais
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegrationsClient({
  integrations,
  apiKeys,
  whiteLabel,
}: {
  integrations: IntegrationView[];
  apiKeys: ApiKey[];
  whiteLabel: WhiteLabel;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState({ label: "", scope: "leitura" });
  const [revealed, setRevealed] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast.success("Conta Google autorizada. Faça a primeira sincronização.");
      router.replace("/admin/configuracoes");
    } else if (error) {
      const messages: Record<string, string> = {
        google_credentials: "Configure Client ID e Client Secret antes de conectar.",
        access_denied: "A autorização foi cancelada no Google.",
        invalid_state: "A sessão OAuth expirou. Tente conectar novamente.",
        token_exchange_failed: "Falha ao concluir a autorização Google.",
      };
      const detail = searchParams.get("detail");
      toast.error(messages[error] ?? "Não foi possível autorizar a conta Google.", {
        description: detail ?? undefined,
      });
      router.replace("/admin/configuracoes");
    }
  }, [router, searchParams]);

  const google = integrations.filter((i) => i.category === "google");
  const others = integrations.filter((i) => i.category !== "google");

  async function createKey() {
    if (!newKey.label.trim()) {
      toast.error("Informe um rótulo para a chave.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRevealed(data.fullKey);
      setNewKey({ label: "", scope: "leitura" });
      router.refresh();
    } catch {
      toast.error("Erro ao gerar chave.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Chave revogada.");
      router.refresh();
    } catch {
      toast.error("Erro ao revogar chave.");
    }
  }

  const sectionTitle = "font-display text-base font-semibold tracking-tight";

  return (
    <div className="space-y-10">
      {/* Google Workspace */}
      <section>
        <div className="mb-4">
          <h2 className={sectionTitle}>Google Workspace</h2>
          <p className="mt-1 text-xs text-subtle">
            Contatos e agenda sincronizados nos dois sentidos via OAuth 2.0.
          </p>
        </div>
        <div className="mb-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Preparação no Google Cloud Console
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-[11.5px] leading-relaxed text-subtle">
            <li>Ative Google People API e Google Calendar API no projeto.</li>
            <li>Crie credenciais OAuth 2.0 do tipo “Aplicativo da Web”.</li>
            <li>Cadastre exatamente a URI de redirecionamento abaixo.</li>
          </ol>
          <div className="mt-3">
            <Copyable
              text={`${origin || "https://seu-dominio.com"}/api/integrations/google/callback`}
            />
          </div>
        </div>
        <div className="space-y-3">
          {google.map((i) => (
            <IntegrationCard key={i.id} item={i} />
          ))}
        </div>
      </section>

      {/* Outras integrações */}
      <section>
        <div className="mb-4">
          <h2 className={sectionTitle}>Mensageria & infraestrutura</h2>
          <p className="mt-1 text-xs text-subtle">
            Canais de atendimento e serviços externos da plataforma.
          </p>
        </div>
        <div className="space-y-3">
          {others.map((i) => (
            <IntegrationCard key={i.id} item={i} />
          ))}
        </div>
      </section>

      {/* Chaves de API */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={sectionTitle}>Chaves de API</h2>
            <p className="mt-1 text-xs text-subtle">
              Para integrar sistemas externos à API do ImobManager.
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Gerar chave
          </Button>
        </div>
        <div className="card-elev divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
          {apiKeys.length === 0 && (
            <p className="py-12 text-center text-sm text-subtle">
              Nenhuma chave gerada ainda.
            </p>
          )}
          {apiKeys.map((k) => (
            <div
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    k.revoked ? "bg-soft text-subtle" : "bg-accent/12 text-accent",
                  )}
                >
                  <KeyRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      k.revoked && "text-subtle line-through",
                    )}
                  >
                    {k.label}
                  </p>
                  <p className="font-mono text-[10.5px] text-subtle">
                    {k.prefix}••••••••••••  ·  {SCOPE_LABELS[k.scope]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                  {k.revoked ? "revogada" : `criada ${timeAgo(k.createdAt)}`}
                </span>
                {!k.revoked && (
                  <button
                    onClick={() => revoke(k.id)}
                    aria-label="Revogar"
                    className="rounded-lg p-2 text-subtle transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Endpoints */}
      <section>
        <div className="mb-4">
          <h2 className={sectionTitle}>Endpoints públicos</h2>
          <p className="mt-1 text-xs text-subtle">
            URLs para configurar nos portais e serviços externos.
          </p>
        </div>
        <div className="card-elev space-y-3 rounded-2xl border border-hairline bg-card p-5">
          {[
            ["Feed XML de imóveis", `https://${whiteLabel.domain}/api/feed.xml`],
            ["Webhook de leads", `https://${whiteLabel.domain}/api/contacts`],
            ["Healthcheck", `https://${whiteLabel.domain}/api/health`],
          ].map(([label, url]) => (
            <div key={label}>
              <p className="mb-1.5 text-xs font-medium text-subtle">{label}</p>
              <Copyable text={url} />
            </div>
          ))}
        </div>
      </section>

      {/* Segurança */}
      <section>
        <div className="card-elev flex items-start gap-3.5 rounded-2xl border border-hairline bg-card p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Segurança dos segredos</p>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-subtle">
              Client secrets, access tokens e refresh tokens nunca são serializados
              para o navegador. Em produção, configure um cofre de segredos ou
              criptografia da camada de infraestrutura. Chaves revogadas deixam de
              ser aceitas imediatamente; rotacione credenciais a cada 90 dias.
            </p>
          </div>
        </div>
      </section>

      {/* Modal nova chave */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setRevealed(null);
        }}
        title={revealed ? "Chave gerada" : "Gerar chave de API"}
      >
        {revealed ? (
          <div>
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
              <TriangleAlert className="size-4 shrink-0" />
              Copie agora — por segurança, o segredo completo não será exibido
              novamente.
            </p>
            <div className="mt-4">
              <Copyable text={revealed} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  setOpen(false);
                  setRevealed(null);
                }}
              >
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Field label="Rótulo da chave" hint="Ex.: Integração site institucional">
                <Input
                  value={newKey.label}
                  onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                  placeholder="Nome do sistema que vai consumir"
                />
              </Field>
              <Field label="Permissões">
                <Select
                  value={newKey.scope}
                  onChange={(e) => setNewKey({ ...newKey, scope: e.target.value })}
                >
                  {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="accent" loading={creating} onClick={createKey}>
                <KeyRound className="size-4" />
                Gerar chave
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
