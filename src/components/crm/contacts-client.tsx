"use client";

import {
  ActiveFilterChips,
  activeFilterChips,
  applyContactFilters,
  ContactFiltersPanel,
  contactsToCsv,
  EMPTY_FILTERS,
  type ContactFilters,
  type ContactMeta,
} from "@/components/crm/contact-filters";
import { LeadDrawer } from "@/components/crm/lead-drawer";
import { Badge, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import {
  CONTACT_TYPE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
} from "@/lib/labels";
import type { Contact } from "@/db/schema";
import { cn, formatCompact, initials, timeAgo } from "@/lib/utils";
import { isRuralType } from "@/lib/rural";
import { ArrowUpRight, Building2, Cloud, Download, Layers, Plus, Search, SlidersHorizontal, Tractor, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const SOURCE_STYLES: Record<string, string> = {
  site: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  whatsapp: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  portal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  indicacao: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  visita: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  google: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export type ContactsTab = "todos" | "imoveis" | "rurais";
type Segment = { urbano: boolean; rural: boolean };

const FILTERS_KEY = "crm-contact-filters";

/** Segmento de um contato recém-criado (sem negociações): pelo interesse. */
function segmentOf(c: Contact, segments: Record<string, Segment>): Segment {
  if (segments[c.id]) return segments[c.id];
  const rural = c.interestTypes.some(isRuralType);
  return { rural, urbano: c.interestTypes.some((t) => !isRuralType(t)) || !rural };
}

export function ContactsClient({
  initial,
  segments = {},
  meta = {},
  initialTab = "todos",
}: {
  initial: Contact[];
  segments?: Record<string, Segment>;
  meta?: Record<string, ContactMeta>;
  initialTab?: ContactsTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ContactsTab>(initialTab);
  const [items, setItems] = useState(initial);
  const [filters, setFilters] = useState<ContactFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const patch = (p: Partial<ContactFilters>) => setFilters((f) => ({ ...f, ...p }));

  // Lembra os filtros do usuário neste navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFilters({ ...EMPTY_FILTERS, ...JSON.parse(saved), q: "" });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {}
  }, [filters]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    type: "lead",
    source: "indicacao",
    budgetMin: "",
    budgetMax: "",
    interestTypes: [] as string[],
    neighborhoods: "",
    notes: "",
  });

  const counts = useMemo(
    () => ({
      todos: items.length,
      imoveis: items.filter((c) => segmentOf(c, segments).urbano).length,
      rurais: items.filter((c) => segmentOf(c, segments).rural).length,
    }),
    [items, segments],
  );

  function switchTab(t: ContactsTab) {
    setTab(t);
    router.replace(t === "todos" ? pathname : `${pathname}?tipo=${t}`, { scroll: false });
  }

  const inTab = useMemo(() => {
    if (tab === "imoveis") return items.filter((c) => segmentOf(c, segments).urbano);
    if (tab === "rurais") return items.filter((c) => segmentOf(c, segments).rural);
    return items;
  }, [items, tab, segments]);

  const filtered = useMemo(
    () => applyContactFilters(inTab, filters, meta),
    [inTab, filters, meta],
  );

  // Imóveis ligados a algum contato (para o filtro por imóvel)
  const linkedProperties = useMemo(() => {
    const map = new Map<string, { id: string; code: string; title: string }>();
    for (const m of Object.values(meta)) for (const p of m.properties) map.set(p.id, p);
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [meta]);

  const chips = activeFilterChips(
    filters,
    (id) => linkedProperties.find((p) => p.id === id)?.code ?? "Imóvel",
  );

  function exportCsv() {
    const blob = new Blob([contactsToCsv(filtered, meta)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleInterest(t: string) {
    setForm((f) => ({
      ...f,
      interestTypes: f.interestTypes.includes(t)
        ? f.interestTypes.filter((x) => x !== t)
        : [...f.interestTypes, t],
    }));
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          type: form.type,
          source: form.source,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
          interestTypes: form.interestTypes,
          neighborhoods: form.neighborhoods
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: Contact = await res.json();
      setItems((arr) => [created, ...arr]);
      toast.success(`${created.name} adicionado à agenda.`);
      setOpen(false);
      setForm({ ...form, name: "", phone: "", email: "", budgetMin: "", budgetMax: "", interestTypes: [], neighborhoods: "", notes: "" });
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o contato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full border border-hairline p-1">
        {(
          [
            { id: "todos", label: "Todos", icon: Layers },
            { id: "imoveis", label: "Imóveis", icon: Building2 },
            { id: "rurais", label: "Rurais", icon: Tractor },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300",
              tab === t.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
            <span className="font-mono text-[10.5px] opacity-60">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Buscar por nome, telefone, e-mail, bairro ou observação…"
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters || chips.length ? "primary" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="size-4" />
          Filtros
          {chips.length > 0 && (
            <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] text-on-accent">
              {chips.length}
            </span>
          )}
        </Button>
        <Select
          value={filters.sort}
          onChange={(e) => patch({ sort: e.target.value as ContactFilters["sort"] })}
          className="w-auto"
          aria-label="Ordenar"
        >
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="name">Nome (A–Z)</option>
          <option value="budget_desc">Maior orçamento</option>
          <option value="budget_asc">Menor orçamento</option>
        </Select>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Novo contato
        </Button>
      </div>

      {showFilters && (
        <ContactFiltersPanel
          value={filters}
          onChange={patch}
          onReset={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
          contacts={inTab}
          meta={meta}
          properties={linkedProperties}
        />
      )}
      <ActiveFilterChips chips={chips} onClear={patch} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          {filtered.length} de {inTab.length} contatos
          {chips.length > 0 && (
            <button
              onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
              className="ml-3 normal-case tracking-normal text-ink underline underline-offset-4"
            >
              limpar filtros
            </button>
          )}
        </p>
        <button
          onClick={exportCsv}
          disabled={!filtered.length}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink disabled:opacity-40"
        >
          <Download className="size-3.5" />
          Exportar CSV ({filtered.length})
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline bg-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              <th className="px-5 py-3.5 font-medium">Nome</th>
              <th className="px-4 py-3.5 font-medium">Tipo</th>
              <th className="px-4 py-3.5 font-medium">Origem</th>
              <th className="px-4 py-3.5 font-medium">Interesse</th>
              <th className="px-4 py-3.5 text-right font-medium">Orçamento</th>
              <th className="px-4 py-3.5 text-right font-medium">Na base</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="group border-b border-hairline/60 transition-colors last:border-0 hover:bg-soft/50"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => setPreviewId(c.id)}
                      className="flex min-w-0 items-center gap-3.5 text-left"
                      title="Visão rápida do lead"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft font-mono text-[11px] font-semibold text-subtle transition-colors group-hover:bg-ink group-hover:text-canvas">
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 truncate font-medium leading-tight group-hover:underline group-hover:underline-offset-4">
                          {c.name}
                          {segmentOf(c, segments).rural && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600"
                              title="Interesse ou negociação em propriedade rural"
                            >
                              <Tractor className="size-3" />
                              Rural
                            </span>
                          )}
                          {c.googleResourceName && (
                            <Cloud
                              className="size-3.5 shrink-0 text-blue-500"
                              aria-label="Sincronizado com Google Contacts"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10.5px] tabular text-subtle">
                          {c.email ?? c.phone}
                        </span>
                      </span>
                    </button>
                    <Link
                      href={`/crm/contatos/${c.id}`}
                      aria-label={`Abrir perfil de ${c.name}`}
                      className="ml-auto rounded-full p-2 text-subtle opacity-0 transition-all hover:bg-soft hover:text-ink group-hover:opacity-100"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-subtle">{CONTACT_TYPE_LABELS[c.type]}</td>
                <td className="px-4 py-3">
                  <Badge className={cn("border", SOURCE_STYLES[c.source])}>
                    {SOURCE_LABELS[c.source]}
                  </Badge>
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-xs text-subtle">
                  {c.interestTypes.length
                    ? c.interestTypes.map((t) => TYPE_LABELS[t] ?? t).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular text-subtle">
                  {c.budgetMin && c.budgetMax
                    ? `${formatCompact(c.budgetMin)} – ${formatCompact(c.budgetMax)}`
                    : c.budgetMax
                      ? `até ${formatCompact(c.budgetMax)}`
                      : c.budgetMin
                        ? `a partir de ${formatCompact(c.budgetMin)}`
                        : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-subtle">
                  {timeAgo(c.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-14 text-center text-sm text-subtle">
            {tab === "rurais"
              ? "Nenhum contato rural — marque interesse em fazenda, sítio ou chácara."
              : chips.length || filters.q
                ? "Nenhum contato com esses filtros."
                : "Nenhum contato encontrado."}
          </p>
        )}
      </div>

      <LeadDrawer contactId={previewId} onClose={() => setPreviewId(null)} />

      {/* Novo contato */}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo contato" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Helena Rocha" />
          </Field>
          <Field label="WhatsApp / telefone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 98765-4321" inputMode="tel" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="helena@email.com" />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Origem">
            <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Orçamento mínimo (R$)">
            <Input type="number" min={0} value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} className="font-mono tabular" />
          </Field>
          <Field label="Orçamento máximo (R$)">
            <Input type="number" min={0} value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} className="font-mono tabular" />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-subtle">
              Interesse em
            </span>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="size-3.5 text-subtle" />
                {Object.entries(TYPE_LABELS).filter(([k]) => !isRuralType(k)).map(([k, v]) => {
                const on = form.interestTypes.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleInterest(k)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-xs font-medium transition-all",
                      on
                        ? "border-transparent bg-accent text-on-accent"
                        : "border-hairline text-subtle hover:text-ink",
                    )}
                  >
                    {v}
                  </button>
                );
              })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tractor className="size-3.5 text-subtle" />
                {Object.entries(TYPE_LABELS).filter(([k]) => isRuralType(k)).map(([k, v]) => {
                const on = form.interestTypes.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleInterest(k)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-xs font-medium transition-all",
                      on
                        ? "border-transparent bg-accent text-on-accent"
                        : "border-hairline text-subtle hover:text-ink",
                    )}
                  >
                    {v}
                  </button>
                );
              })}
              </div>
            </div>
          </div>
          <Field label="Bairros de interesse" hint="Separados por vírgula" className="sm:col-span-2">
            <Input value={form.neighborhoods} onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })} placeholder="Jardins, Pinheiros, Moema" />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexto, preferências, timing…" />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="accent" loading={saving} onClick={submit}>
            <UserPlus className="size-4" />
            Salvar contato
          </Button>
        </div>
      </Modal>
    </div>
  );
}
