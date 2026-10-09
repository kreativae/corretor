"use client";

import { LeadDrawer } from "@/components/crm/lead-drawer";
import { Badge, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import {
  CONTACT_TYPE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
} from "@/lib/labels";
import type { Contact } from "@/db/schema";
import { cn, formatCompact, initials, timeAgo } from "@/lib/utils";
import { ArrowUpRight, Cloud, Plus, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const SOURCE_STYLES: Record<string, string> = {
  site: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  whatsapp: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  portal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  indicacao: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  visita: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  google: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export function ContactsClient({ initial }: { initial: Contact[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
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

  const filtered = useMemo(() => {
    let list = items;
    if (type !== "all") list = list.filter((c) => c.type === type);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(t) ||
          c.phone.includes(t) ||
          (c.email ?? "").toLowerCase().includes(t),
      );
    }
    return list;
  }, [items, q, type]);

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail…"
            className="pl-10"
          />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
          <option value="all">Todos os tipos</option>
          {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Novo contato
        </Button>
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
        {filtered.length} de {items.length} contatos
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              <th className="px-5 py-3.5 font-medium">Nome</th>
              <th className="px-4 py-3.5 font-medium">Tipo</th>
              <th className="px-4 py-3.5 font-medium">Origem</th>
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
                <td className="px-4 py-3 text-right font-mono text-xs tabular text-subtle">
                  {c.budgetMax
                    ? `até ${formatCompact(c.budgetMax)}`
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
            Nenhum contato encontrado.
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
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_LABELS).map(([k, v]) => {
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
