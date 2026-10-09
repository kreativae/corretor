"use client";

import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Contact } from "@/db/schema";
import {
  CONTACT_TYPE_LABELS,
  DEAL_STAGE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_STYLES,
} from "@/lib/labels";
import { cn, formatBRL, formatCompact, formatDateTime, initials, timeAgo } from "@/lib/utils";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeleteContactButton } from "./delete-contact-button";

type LeadData = {
  contact: Contact;
  visits: {
    id: string;
    scheduledAt: string;
    status: string;
    propertyCode: string | null;
    propertyTitle: string | null;
  }[];
  deals: {
    id: string;
    stage: string;
    value: number;
    propertyCode: string | null;
    propertyTitle: string | null;
  }[];
  matches: {
    id: string;
    code: string;
    title: string;
    neighborhood: string;
    price: number;
    cover: string | null;
    score: number;
  }[];
};

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  type: "lead",
  source: "site",
  budgetMin: "",
  budgetMax: "",
  interestTypes: [] as string[],
  neighborhoods: "",
  notes: "",
};

export function LeadDrawer({
  contactId,
  onClose,
}: {
  contactId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!contactId) {
      setData(null);
      setEditing(false);
      return;
    }
    setLoading(true);
    setData(null);
    setEditing(false);
    document.body.style.overflow = "hidden";
    fetch(`/api/contacts/${contactId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
    return () => {
      document.body.style.overflow = "";
    };
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [contactId, onClose]);

  if (!contactId) return null;

  const c = data?.contact;

  function startEdit() {
    if (!c) return;
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      type: c.type,
      source: c.source,
      budgetMin: c.budgetMin != null ? String(c.budgetMin) : "",
      budgetMax: c.budgetMax != null ? String(c.budgetMax) : "",
      interestTypes: c.interestTypes,
      neighborhoods: c.neighborhoods.join(", "),
      notes: c.notes ?? "",
    });
    setEditing(true);
  }

  function toggleInterest(t: string) {
    setForm((f) => ({
      ...f,
      interestTypes: f.interestTypes.includes(t)
        ? f.interestTypes.filter((x) => x !== t)
        : [...f.interestTypes, t],
    }));
  }

  async function save() {
    if (!c) return;
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${c.id}`, {
        method: "PATCH",
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
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated: Contact = await res.json();
      setData((prev) => (prev ? { ...prev, contact: updated } : prev));
      setEditing(false);
      toast.success(`Dados de ${updated.name.split(" ")[0]} atualizados.`);
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal>
      {/* Backdrop com blur total */}
      <div
        className="animate-blur-in absolute inset-0 bg-black/35 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Painel lateral */}
      <aside className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-subtle">
            {editing ? "Editar lead" : "Visão rápida do lead"}
          </p>
          <div className="flex items-center gap-1">
            {c && !editing && (
              <button
                onClick={startEdit}
                aria-label="Editar dados"
                title="Editar dados"
                className="rounded-full p-2 text-subtle transition-colors hover:bg-soft hover:text-ink"
              >
                <Pencil className="size-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-full p-2 text-subtle transition-colors hover:bg-soft hover:text-ink"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
          {loading || !c ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-subtle">
              <Loader2 className="size-5 animate-spin" />
              <p className="font-mono text-[11px] uppercase tracking-[0.18em]">
                carregando perfil…
              </p>
            </div>
          ) : editing ? (
            /* ─────────── Modo edição ─────────── */
            <div className="space-y-4 px-6 py-6">
              <Field label="Nome completo">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone / WhatsApp">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Orçamento mín. (R$)">
                  <Input type="number" min={0} value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} className="font-mono tabular" />
                </Field>
                <Field label="Orçamento máx. (R$)">
                  <Input type="number" min={0} value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} className="font-mono tabular" />
                </Field>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-subtle">
                  Interesse em
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => {
                    const on = form.interestTypes.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleInterest(k)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
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
              <Field label="Bairros de interesse" hint="Separados por vírgula">
                <Input value={form.neighborhoods} onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })} placeholder="Jardins, Pinheiros…" />
              </Field>
              <Field label="Observações">
                <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          ) : (
            /* ─────────── Modo visualização ─────────── */
            <div className="space-y-6 px-6 py-6">
              <div className="flex items-start gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ink font-mono text-lg font-semibold text-canvas">
                  {initials(c.name)}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold leading-tight tracking-tight">
                    {c.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge className="border-transparent bg-accent/10 text-accent">
                      {CONTACT_TYPE_LABELS[c.type]}
                    </Badge>
                    <Badge>{SOURCE_LABELS[c.source]}</Badge>
                  </div>
                  <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                    na base {timeAgo(c.createdAt)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a href={waLink(c.phone)} target="_blank" rel="noreferrer">
                  <Button variant="accent" size="sm" className="h-10 w-full">
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </Button>
                </a>
                <a href={`tel:+${c.phone.replace(/\D/g, "")}`}>
                  <Button variant="outline" size="sm" className="h-10 w-full">
                    <Phone className="size-4" />
                    Ligar
                  </Button>
                </a>
              </div>

              <div className="space-y-1 rounded-2xl border border-hairline p-4">
                <p className="flex items-center gap-2.5 font-mono text-[13px] tabular">
                  <Phone className="size-3.5 text-subtle" />
                  {c.phone}
                </p>
                {c.email && (
                  <p className="flex items-center gap-2.5 truncate text-[13px]">
                    <Mail className="size-3.5 shrink-0 text-subtle" />
                    {c.email}
                  </p>
                )}
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
                  Perfil de busca
                </p>
                <p className="mt-2 font-mono text-base font-medium tabular">
                  {c.budgetMin || c.budgetMax
                    ? `${c.budgetMin ? formatCompact(c.budgetMin) : "—"} → ${c.budgetMax ? formatCompact(c.budgetMax) : "—"}`
                    : "Orçamento não informado"}
                </p>
                {(c.interestTypes.length > 0 || c.neighborhoods.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {c.interestTypes.map((t) => (
                      <Badge key={t} className="border-transparent bg-soft text-subtle">
                        {TYPE_LABELS[t]}
                      </Badge>
                    ))}
                    {c.neighborhoods.map((n) => (
                      <Badge key={n}>{n}</Badge>
                    ))}
                  </div>
                )}
                {c.notes && (
                  <p className="mt-3 rounded-xl bg-soft p-3 text-xs leading-relaxed text-subtle">
                    {c.notes}
                  </p>
                )}
              </div>

              {data.deals.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
                    Negociações · {data.deals.length}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {data.deals.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-xl border border-hairline px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">
                            {DEAL_STAGE_LABELS[d.stage]}
                          </p>
                          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-subtle">
                            {d.propertyCode ?? "sem imóvel"}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-medium tabular">
                          {formatBRL(d.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.visits.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
                    Visitas · {data.visits.length}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {data.visits.slice(0, 4).map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-2.5"
                      >
                        <CalendarDays className="size-4 shrink-0 text-subtle" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">
                            {v.propertyTitle ?? "—"}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                            {formatDateTime(v.scheduledAt)}
                          </p>
                        </div>
                        <Badge
                          className={cn("border px-2 py-0.5 text-[10px]", VISIT_STATUS_STYLES[v.status])}
                        >
                          {VISIT_STATUS_LABELS[v.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.matches.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
                    <Sparkles className="size-3.5 text-accent" />
                    Smart match
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {data.matches.map((m) => (
                      <Link
                        key={m.id}
                        href={`/crm/imoveis/${m.id}`}
                        onClick={onClose}
                        className="group flex items-center gap-3 rounded-xl border border-hairline p-2.5 transition-colors hover:border-hairline-strong hover:bg-soft/50"
                      >
                        <span className="relative block size-11 shrink-0 overflow-hidden rounded-lg bg-soft">
                          {m.cover ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={m.cover}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <Building2 className="absolute inset-0 m-auto size-4 text-subtle" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {m.title}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                            {m.neighborhood} ·{" "}
                            <span className="tabular">{formatCompact(m.price)}</span>
                          </span>
                        </span>
                        <span className="font-mono text-sm font-medium tabular text-accent">
                          {m.score}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-hairline p-4">
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="accent" loading={saving} onClick={save}>
                <Check className="size-4" />
                Salvar alterações
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href={`/crm/contatos/${contactId}`} onClick={onClose}>
                <Button variant="primary" className="w-full">
                  Abrir perfil completo
                  <ArrowUpRight className="size-4" />
                </Button>
              </Link>
              {c && data && (
                <DeleteContactButton
                  contactId={c.id}
                  contactName={c.name}
                  linkedToGoogle={!!c.googleResourceName}
                  dealsCount={data.deals.length}
                  visitsCount={data.visits.length}
                  onDeleted={() => {
                    onClose();
                    router.refresh();
                  }}
                />
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
