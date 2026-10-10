"use client";

import { Badge, Button, Field, Input, Select, Switch } from "@/components/ui";
import { PORTAL_STATUS_LABELS, ROLE_LABELS } from "@/lib/labels";
import type { Portal, User } from "@/db/schema";
import type { WhiteLabel } from "@/lib/queries";
import { cn, initials, timeAgo } from "@/lib/utils";
import { Check, Copy, FileCode2, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const ACCENTS = [
  { name: "Laranja da marca", value: "#f47525" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Azul elétrico", value: "#4f7cff" },
  { name: "Laranja queimado", value: "#f26a1b" },
  { name: "Grafite dourado", value: "#d4a94e" },
];

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
      className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-soft hover:text-ink"
      aria-label="Copiar"
    >
      {ok ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function AdminClient({
  users,
  portals,
  whiteLabel,
  feedPath,
}: {
  users: User[];
  portals: Portal[];
  whiteLabel: WhiteLabel;
  feedPath: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "corretor", creci: "" });
  const [savingUser, setSavingUser] = useState(false);
  const [wl, setWl] = useState(whiteLabel);
  const [savingWl, setSavingWl] = useState(false);

  const feedUrl =
    typeof window !== "undefined" ? `${window.location.origin}${feedPath}` : feedPath;

  async function addUser() {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios.");
      return;
    }
    setSavingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) throw new Error();
      toast.success(`${newUser.name} adicionado à equipe.`);
      setNewUser({ name: "", email: "", role: "corretor", creci: "" });
      router.refresh();
    } catch {
      toast.error("Erro ao criar usuário (e-mail já existe?).");
    } finally {
      setSavingUser(false);
    }
  }

  async function togglePortal(p: Portal, enabled: boolean) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/portals/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? `${p.name} conectado.` : `${p.name} desconectado.`);
      router.refresh();
    } catch {
      toast.error("Falha ao atualizar integração.");
    } finally {
      setBusy(null);
    }
  }

  async function syncPortal(p: Portal) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/portals/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${p.name} sincronizado com sucesso.`);
      router.refresh();
    } catch {
      toast.error("Erro ao sincronizar.");
    } finally {
      setBusy(null);
    }
  }

  async function saveWhiteLabel() {
    setSavingWl(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "whiteLabel", value: wl }),
      });
      if (!res.ok) throw new Error();
      toast.success("Identidade aplicada — o site já usa a nova cor.");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar identidade.");
    } finally {
      setSavingWl(false);
    }
  }

  const card = "rounded-2xl border border-hairline bg-card p-6";
  const h2 = "font-display text-base font-semibold tracking-tight";

  return (
    <div className="space-y-10">
      {/* ─────── Equipe ─────── */}
      <section id="equipe">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className={h2}>Equipe &amp; permissões</h2>
            <p className="mt-1 text-xs text-subtle">
              RBAC: administradores gerenciam integrações; corretores operam o pipeline.
            </p>
          </div>
        </div>
        <div className={cn(card, "overflow-hidden p-0")}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
                <th className="px-6 py-3.5 font-medium">Membro</th>
                <th className="px-4 py-3.5 font-medium">Função</th>
                <th className="px-4 py-3.5 font-medium">CRECI</th>
                <th className="px-4 py-3.5 text-right font-medium">Desde</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-hairline/60 last:border-0 hover:bg-soft/40">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-semibold text-canvas">
                        {initials(u.name)}
                      </span>
                      <div>
                        <p className="font-medium leading-tight">{u.name}</p>
                        <p className="font-mono text-[11px] text-subtle">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      className={cn(
                        "border",
                        u.role === "admin"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                          : "border-sky-500/20 bg-sky-500/10 text-sky-500",
                      )}
                    >
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-subtle">
                    {u.creci ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-subtle">
                    {timeAgo(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-soft/40 p-4">
            <Input
              placeholder="Nome do corretor"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="h-9 w-48 text-xs"
            />
            <Input
              placeholder="email@imob.com"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="h-9 w-56 text-xs"
            />
            <Select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="h-9 w-40 text-xs"
            >
              <option value="corretor">Corretor</option>
              <option value="admin">Administrador</option>
            </Select>
            <Input
              placeholder="CRECI (opcional)"
              value={newUser.creci}
              onChange={(e) => setNewUser({ ...newUser, creci: e.target.value })}
              className="h-9 w-36 text-xs"
            />
            <Button size="sm" variant="accent" loading={savingUser} onClick={addUser} className="h-9">
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </section>

      {/* ─────── Integrações ─────── */}
      <section id="integracoes">
        <div className="mb-4">
          <h2 className={h2}>Portais &amp; feed XML</h2>
          <p className="mt-1 text-xs text-subtle">
            Distribuição automática dos anúncios publicados nos maiores portais do país.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {portals.map((p) => (
            <div key={p.id} className={card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-soft font-mono text-sm font-bold uppercase">
                    {p.name.slice(0, 2)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                      {p.lastSyncAt ? `sync ${timeAgo(p.lastSyncAt)}` : "nunca sincronizado"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={p.enabled}
                  onChange={(v) => togglePortal(p, v)}
                  disabled={busy === p.id}
                />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "border",
                      p.enabled
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                        : "border-hairline bg-soft text-subtle",
                    )}
                  >
                    {PORTAL_STATUS_LABELS[p.status]}
                  </Badge>
                  <span className="font-mono text-[11px] tabular text-subtle">
                    {p.listings} anúncios ativos
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!p.enabled || busy === p.id}
                  loading={busy === p.id}
                  onClick={() => syncPortal(p)}
                >
                  <RefreshCw className={cn("size-3.5", busy === p.id && "animate-spin")} />
                  Sincronizar
                </Button>
              </div>
            </div>
          ))}

          {/* Feed XML */}
          <div className={cn(card, "md:col-span-2")}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-soft">
                  <FileCode2 className="size-5 text-subtle" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Feed XML universal</p>
                  <p className="text-xs text-subtle">
                    Endpoint público no padrão dos portais — atualiza a cada publicação.
                  </p>
                </div>
              </div>
              <a
                href={feedPath}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-hairline px-4 py-2 text-xs font-medium transition-colors hover:bg-soft"
              >
                Abrir feed
              </a>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-soft px-4 py-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-subtle">
                {feedUrl}
              </code>
              <CopyButton text={feedUrl} />
            </div>
          </div>
        </div>
      </section>

      {/* ─────── Chaves de API ─────── */}
      <section>
        <div className="mb-4">
          <h2 className={h2}>Chaves de API</h2>
          <p className="mt-1 text-xs text-subtle">
            Tokens criptografados (AES-256). Nunca exibidos por completo.
          </p>
        </div>
        <div className={cn(card, "divide-y divide-hairline p-0")}>
          {[
            { name: "ImobManager Public API", key: "imob_live_9f2c••••••••••••e4a1" },
            { name: "Google Calendar / Contacts", key: "gcp_sync_7b41••••••••••••02fd" },
            { name: "WhatsApp Business Cloud", key: "waba_c3d8••••••••••••79be" },
          ].map((k) => (
            <div key={k.name} className="flex items-center justify-between px-6 py-4">
              <p className="text-sm font-medium">{k.name}</p>
              <div className="flex items-center gap-2">
                <code className="hidden font-mono text-xs text-subtle sm:block">{k.key}</code>
                <CopyButton text={k.key} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────── White label ─────── */}
      <section id="marca">
        <div className="mb-4">
          <h2 className={h2}>White label — identidade da marca</h2>
          <p className="mt-1 text-xs text-subtle">
            Aplicada instantaneamente ao site público, CRM e materiais exportados.
          </p>
        </div>
        <div className={card}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nome da organização">
              <Input value={wl.orgName} onChange={(e) => setWl({ ...wl, orgName: e.target.value })} />
            </Field>
            <Field label="Domínio do site">
              <Input value={wl.domain} onChange={(e) => setWl({ ...wl, domain: e.target.value })} />
            </Field>
            <Field label="WhatsApp comercial" hint="DDI + DDD + número, só dígitos">
              <Input value={wl.phone} onChange={(e) => setWl({ ...wl, phone: e.target.value })} className="font-mono tabular" />
            </Field>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-subtle">
                Cor de acento
              </span>
              <div className="flex items-center gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    title={a.name}
                    onClick={() => setWl({ ...wl, accent: a.value })}
                    className={cn(
                      "size-9 rounded-full border-2 transition-transform duration-200 hover:scale-110",
                      wl.accent === a.value
                        ? "border-ink"
                        : "border-transparent",
                    )}
                    style={{ background: a.value }}
                  />
                ))}
                <input
                  type="color"
                  value={wl.accent}
                  onChange={(e) => setWl({ ...wl, accent: e.target.value })}
                  className="size-9 cursor-pointer rounded-full border border-hairline bg-transparent"
                  aria-label="Cor personalizada"
                />
                <code className="font-mono text-xs text-subtle">{wl.accent}</code>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="accent" loading={savingWl} onClick={saveWhiteLabel}>
              <Check className="size-4" />
              Aplicar identidade
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
