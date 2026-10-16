"use client";

import { Button, Field, Input, Modal, Switch, Textarea } from "@/components/ui";
import { MODULES, type Account } from "@/lib/modules";
import { roleLabel } from "@/lib/roles";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import {
  Building2,
  Crown,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Usage = {
  activeUsers: number;
  properties: number;
  rurais: number;
  published: number;
  contacts: number;
  leads30: number;
  openDeals: number;
  closedDeals: number;
  lastActivity: string | null;
  whatsapp: string | null;
  email: boolean;
};
type Member = { id: string; name: string; email: string; role?: string; active?: boolean; lastLoginAt: string | null };

const card = "rounded-2xl border border-hairline bg-card p-5 sm:p-6";
const h2 = "font-display text-base font-semibold tracking-tight";

/** Painel da gerência: conta, plano, limites, módulos, uso e acessos de gerência */
export function GerenciaPanel({
  me,
  client,
  initial,
  usage,
  team,
  managers,
}: {
  me: { id: string; name: string };
  client: string;
  initial: Account;
  usage: Usage;
  team: Member[];
  managers: Member[];
}) {
  const router = useRouter();
  const [acct, setAcct] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(acct) !== JSON.stringify(saved);
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setAcct((a) => ({ ...a, [k]: v }));

  async function save(next = acct) {
    setSaving(true);
    try {
      const res = await fetch("/api/gerencia/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAcct(d);
      setSaved(d);
      toast.success("Conta atualizada.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    const suspend = acct.status === "ativo";
    if (suspend && !confirm(`Suspender o acesso de ${client}? A equipe verá a tela de acesso suspenso.`)) return;
    await save({ ...acct, status: suspend ? "suspenso" : "ativo" });
  }

  /* ── Acessos de gerência ── */
  const [adding, setAdding] = useState(false);
  const [mf, setMf] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function addManager() {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencia/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mf),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("Acesso de gerência criado.");
      setAdding(false);
      setMf({ name: "", email: "", password: "" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeManager(m: Member) {
    if (!confirm(`Remover o acesso de gerência de ${m.name}?`)) return;
    const res = await fetch(`/api/gerencia/managers/${m.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error || "Não foi possível remover.");
    toast.success("Acesso removido.");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/gerencia/entrar");
    router.refresh();
  }

  const suspended = acct.status === "suspenso";
  const limitBar = (used: number, max: number) => (max ? Math.min(100, Math.round((used / max) * 100)) : 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Topo */}
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-ink text-canvas">
          <Crown className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-subtle">Gerência</p>
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{client}</h1>
        </div>
        <Link href="/crm">
          <Button variant="outline" size="sm">
            <LayoutDashboard className="size-4" />
            Abrir CRM
          </Button>
        </Link>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ShieldCheck className="size-4" />
            Administração
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair">
          <LogOut className="size-4" />
        </Button>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {/* Situação */}
          <section className={cn(card, suspended && "border-red-500/40")}>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  suspended ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600",
                )}
              >
                {suspended ? <PauseCircle className="size-3.5" /> : <PlayCircle className="size-3.5" />}
                {suspended ? "Suspensa" : "Ativa"}
              </span>
              <p className="order-last min-w-0 basis-full text-sm text-subtle sm:order-none sm:basis-0 sm:flex-1">
                {suspended ? "A equipe do cliente vê a tela de acesso suspenso." : "A equipe do cliente usa o sistema normalmente."}
              </p>
              <Button variant={suspended ? "accent" : "danger"} size="sm" onClick={toggleStatus} loading={saving} className="ml-auto sm:ml-0">
                {suspended ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
                {suspended ? "Reativar conta" : "Suspender conta"}
              </Button>
            </div>
            <div className="mt-4 grid gap-4 border-t border-hairline pt-4">
              <Field label="Mensagem para quem acessar suspenso" hint="Vazio = mensagem padrão pedindo contato com o suporte.">
                <Textarea rows={2} value={acct.suspendedMessage} onChange={(e) => set("suspendedMessage", e.target.value)} />
              </Field>
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="block font-medium">Tirar o site público do ar durante a suspensão</span>
                  <span className="block text-xs text-subtle">Visitantes veem &quot;Site temporariamente indisponível&quot;.</span>
                </span>
                <Switch checked={acct.suspendSite} onChange={(v) => set("suspendSite", v)} />
              </label>
            </div>
          </section>

          {/* Plano e limites */}
          <section className={card}>
            <h2 className={h2}>Plano e limites</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Plano">
                <Input value={acct.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Ex.: Profissional" />
              </Field>
              <Field label="Usuários ativos" hint="0 = sem limite">
                <Input type="number" min={0} value={acct.maxUsers} onChange={(e) => set("maxUsers", Number(e.target.value) || 0)} className="font-mono" />
              </Field>
              <Field label="Imóveis cadastrados" hint="0 = sem limite">
                <Input
                  type="number"
                  min={0}
                  value={acct.maxProperties}
                  onChange={(e) => set("maxProperties", Number(e.target.value) || 0)}
                  className="font-mono"
                />
              </Field>
            </div>
          </section>

          {/* Módulos */}
          <section className={card}>
            <h2 className={h2}>Módulos liberados</h2>
            <p className="mt-1 text-xs text-subtle">Módulo desligado some do menu e a página deixa de existir para o cliente.</p>
            <div className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-4 p-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-subtle">{m.description}</span>
                  </span>
                  <Switch checked={acct.modules[m.key]} onChange={(v) => set("modules", { ...acct.modules, [m.key]: v })} />
                </label>
              ))}
            </div>
          </section>

          {/* Notas */}
          <section className={card}>
            <h2 className={h2}>Notas internas</h2>
            <p className="mt-1 text-xs text-subtle">Só a gerência vê: contrato, vencimento, contato do responsável…</p>
            <Textarea rows={4} className="mt-3" value={acct.notes} onChange={(e) => set("notes", e.target.value)} />
          </section>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button variant="accent" onClick={() => save()} loading={saving} disabled={!dirty} className="shadow-lg">
              <Save className="size-4" />
              Salvar alterações
            </Button>
          </div>
        </div>

        {/* Coluna lateral */}
        <aside className="min-w-0 space-y-5">
          <section className={card}>
            <h2 className={h2}>Uso</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                { icon: Users, label: "Usuários ativos", value: usage.activeUsers, max: acct.maxUsers },
                { icon: Building2, label: "Imóveis", value: usage.properties, max: acct.maxProperties, sub: `${usage.published} no site · ${usage.rurais} rurais` },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex items-center gap-2">
                    <r.icon className="size-4 text-subtle" />
                    <dt className="flex-1 text-subtle">{r.label}</dt>
                    <dd className="font-mono tabular">
                      {formatNumber(r.value)}
                      {r.max ? <span className="text-subtle"> / {formatNumber(r.max)}</span> : null}
                    </dd>
                  </div>
                  {r.max > 0 && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                      <div
                        className={cn("h-full rounded-full", limitBar(r.value, r.max) >= 100 ? "bg-red-500" : "bg-accent")}
                        style={{ width: `${limitBar(r.value, r.max)}%` }}
                      />
                    </div>
                  )}
                  {r.sub && <p className="mt-1 pl-6 text-[11px] text-subtle">{r.sub}</p>}
                </div>
              ))}
              {[
                ["Contatos", formatNumber(usage.contacts)],
                ["Leads em 30 dias", formatNumber(usage.leads30)],
                ["Negociações abertas", formatNumber(usage.openDeals)],
                ["Negócios fechados", formatNumber(usage.closedDeals)],
                ["Última atividade", usage.lastActivity ? timeAgo(usage.lastActivity) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-t border-hairline pt-3">
                  <dt className="text-subtle">{k}</dt>
                  <dd className="font-mono tabular">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-xs">
              <p className="flex items-center gap-2">
                <MessageCircle className="size-3.5 text-subtle" />
                WhatsApp: <span className="font-medium">{usage.whatsapp ?? "não configurado"}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-subtle" />
                E-mail (Resend): <span className="font-medium">{usage.email ? "configurado" : "não configurado"}</span>
              </p>
            </div>
          </section>

          <section className={card}>
            <h2 className={h2}>Equipe do cliente</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {team.map((u) => (
                <li key={u.id} className={cn("flex items-center gap-2", !u.active && "opacity-50")}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="block truncate text-[11px] text-subtle">
                      {roleLabel(u.role ?? "corretor")} · {u.lastLoginAt ? `entrou ${timeAgo(u.lastLoginAt)}` : "nunca entrou"}
                    </span>
                  </span>
                </li>
              ))}
              {!team.length && <li className="text-subtle">Nenhum usuário.</li>}
            </ul>
            <Link href="/admin/equipe" className="mt-3 inline-flex items-center gap-1 text-xs text-subtle hover:text-ink">
              Gerenciar equipe <ExternalLink className="size-3" />
            </Link>
          </section>

          <section className={card}>
            <div className="flex items-center justify-between">
              <h2 className={h2}>Acessos de gerência</h2>
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                Novo
              </Button>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm">
              {managers.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {m.name}
                      {m.id === me.id && <span className="ml-1 text-[11px] font-normal text-subtle">(você)</span>}
                    </span>
                    <span className="block truncate text-[11px] text-subtle">{m.email}</span>
                  </span>
                  {m.id !== me.id && (
                    <Button variant="ghost" size="icon" onClick={() => removeManager(m)} aria-label={`Remover ${m.name}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-subtle">Contas de gerência não aparecem na equipe do cliente.</p>
          </section>
        </aside>
      </div>

      <Modal open={adding} onClose={() => !busy && setAdding(false)} title="Novo acesso de gerência">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addManager();
          }}
          className="space-y-4"
        >
          <Field label="Nome">
            <Input value={mf.name} onChange={(e) => setMf({ ...mf, name: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={mf.email} onChange={(e) => setMf({ ...mf, email: e.target.value })} />
          </Field>
          <Field label="Senha (mín. 8)">
            <Input type="password" value={mf.password} onChange={(e) => setMf({ ...mf, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={busy}>
              Criar acesso
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
