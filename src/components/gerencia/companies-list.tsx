"use client";

import { Button, Field, Input, Modal } from "@/components/ui";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import { AlertTriangle, Building2, ChevronRight, Crown, LogOut, PauseCircle, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Company = {
  slug: string;
  name: string;
  main: boolean;
  domains: string[];
  createdAt: string;
  status: "ativo" | "suspenso" | null;
  plan: string;
  users: number;
  properties: number;
  contacts: number;
  lastActivity: string | null;
  error: string | null;
};
type Manager = { id: string; name: string; email: string; lastLoginAt: string | null };

const card = "rounded-2xl border border-hairline bg-card p-5 sm:p-6";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** Gerência: empresas do sistema, criação de novas e acessos de gerência */
export function CompaniesList({ me, companies, managers }: { me: { id: string; name: string }; companies: Company[]; managers: Manager[] }) {
  const router = useRouter();

  /* ── Nova empresa ── */
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = { name: "", slug: "", plan: "", adminName: "", adminEmail: "", adminPassword: "" };
  const [f, setF] = useState(empty);
  const [slugTouched, setSlugTouched] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencia/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(`${f.name} criada. O administrador já pode entrar com o e-mail e a senha informados.`);
      setCreating(false);
      setF(empty);
      setSlugTouched(false);
      router.push(`/gerencia/empresas/${d.slug}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível criar a empresa.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Acessos de gerência ── */
  const [adding, setAdding] = useState(false);
  const [mf, setMf] = useState({ name: "", email: "", password: "" });

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

  async function removeManager(m: Manager) {
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

  const totals = {
    active: companies.filter((c) => c.status === "ativo").length,
    users: companies.reduce((a, c) => a + c.users, 0),
    properties: companies.reduce((a, c) => a + c.properties, 0),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-ink text-canvas">
          <Crown className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-subtle">Gerência</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Empresas</h1>
        </div>
        <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova empresa
        </Button>
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair">
          <LogOut className="size-4" />
        </Button>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ["Empresas ativas", `${totals.active} de ${companies.length}`],
          ["Usuários", formatNumber(totals.users)],
          ["Imóveis", formatNumber(totals.properties)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-hairline bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">{k}</p>
            <p className="mt-1.5 font-mono text-lg font-medium tabular sm:text-2xl">{v}</p>
          </div>
        ))}
      </div>

      <ul className="mt-5 space-y-3">
        {companies.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/gerencia/empresas/${c.slug}`}
              className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-hairline bg-card p-4 transition-colors hover:bg-soft/50 sm:p-5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-soft text-subtle">
                <Building2 className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-base font-semibold">{c.name}</span>
                  {c.main && <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-medium text-subtle">principal</span>}
                  {c.status === "suspenso" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
                      <PauseCircle className="size-3" /> suspensa
                    </span>
                  )}
                  {c.plan && <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-subtle">{c.plan}</span>}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-subtle">
                  {c.slug}
                  {c.domains.length ? ` · ${c.domains.join(", ")}` : ""}
                </span>
                {c.error && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                    <AlertTriangle className="size-3" /> {c.error}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-4 text-xs text-subtle">
                <span title="Usuários ativos" className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> {c.users}
                </span>
                <span title="Imóveis" className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" /> {formatNumber(c.properties)}
                </span>
                <span className="hidden sm:inline">{c.lastActivity ? `ativa ${timeAgo(c.lastActivity)}` : "sem atividade"}</span>
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className={cn(card, "mt-8")}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Acessos de gerência</h2>
            <p className="text-xs text-subtle">Veem e gerenciam todas as empresas. Não aparecem na equipe de nenhuma delas.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Novo
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-hairline text-sm">
          {managers.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2.5">
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
      </section>

      <Modal open={creating} onClose={() => !busy && setCreating(false)} title="Nova empresa" wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Nome da empresa" className="sm:col-span-2">
            <Input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) })}
              placeholder="Ex.: Silva Imóveis"
              autoFocus
            />
          </Field>
          <Field label="Identificador" hint="Usado em links e no banco. Só letras, números e hífen.">
            <Input
              value={f.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setF({ ...f, slug: slugify(e.target.value) });
              }}
              placeholder="silva-imoveis"
              className="font-mono"
            />
          </Field>
          <Field label="Plano (opcional)">
            <Input value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} placeholder="Ex.: Profissional" />
          </Field>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle sm:col-span-2">Administrador da empresa</p>
          <Field label="Nome">
            <Input value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} />
          </Field>
          <Field label="E-mail (login)">
            <Input type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} />
          </Field>
          <Field label="Senha inicial (mín. 8)" hint="Repasse ao cliente; ele pode trocar depois.">
            <Input value={f.adminPassword} onChange={(e) => setF({ ...f, adminPassword: e.target.value })} autoComplete="off" className="font-mono" />
          </Field>
          <p className="self-end rounded-xl bg-soft px-3 py-2.5 text-xs text-subtle">
            A empresa nasce zerada: sem imóveis, contatos ou configurações. O administrador entra pelo mesmo endereço de login.
          </p>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={busy}>
              <Plus className="size-4" />
              Criar empresa
            </Button>
          </div>
        </form>
      </Modal>

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
