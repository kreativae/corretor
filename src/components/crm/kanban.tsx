"use client";

import { LeadDrawer } from "@/components/crm/lead-drawer";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { DEAL_STAGES } from "@/lib/labels";
import type { DealFull } from "@/lib/queries";
import { cn, formatCompact, initials } from "@/lib/utils";
import { Handshake, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function Kanban({
  initialDeals,
  contacts,
  properties,
}: {
  initialDeals: DealFull[];
  contacts: { id: string; name: string }[];
  properties: { id: string; code: string; title: string; price: number }[];
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contactId: "", propertyId: "", value: "", stage: "novo" });

  const byStage = useMemo(() => {
    const map = new Map<string, DealFull[]>();
    for (const s of DEAL_STAGES) map.set(s.id, []);
    for (const d of deals) map.get(d.deal.stage)?.push(d);
    return map;
  }, [deals]);

  async function move(dealId: string, stage: string) {
    const prev = deals;
    const target = deals.find((d) => d.deal.id === dealId);
    if (!target || target.deal.stage === stage) return;
    setDeals((arr) =>
      arr.map((d) =>
        d.deal.id === dealId
          ? { ...d, deal: { ...d.deal, stage: stage as DealFull["deal"]["stage"] } }
          : d,
      ),
    );
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
      const stageLabel = DEAL_STAGES.find((s) => s.id === stage)?.label;
      toast.success(`Movido para “${stageLabel}”.`);
      router.refresh();
    } catch {
      setDeals(prev);
      toast.error("Não foi possível mover a negociação.");
    }
  }

  async function createDeal() {
    if (!form.contactId) {
      toast.error("Selecione um contato.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: form.contactId,
          propertyId: form.propertyId || null,
          value: form.value ? Number(form.value) : 0,
          stage: form.stage,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const contact = contacts.find((c) => c.id === form.contactId);
      const property = properties.find((p) => p.id === form.propertyId) ?? null;
      setDeals((arr) => [
        {
          deal: created,
          contact: contact
            ? ({ id: contact.id, name: contact.name } as DealFull["contact"])
            : null,
          property: property
            ? ({ id: property.id, code: property.code, title: property.title, price: property.price } as DealFull["property"])
            : null,
        },
        ...arr,
      ]);
      toast.success("Negociação aberta no pipeline.");
      setOpen(false);
      setForm({ contactId: "", propertyId: "", value: "", stage: "novo" });
      router.refresh();
    } catch {
      toast.error("Erro ao criar negociação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Nova negociação
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          const sum = items.reduce((a, d) => a + d.deal.value, 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, stage.id);
                setDragId(null);
                setOverStage(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors duration-200",
                overStage === stage.id
                  ? "border-[rgb(var(--accent))/0.5] bg-soft"
                  : "border-hairline bg-card",
              )}
            >
              <div className="flex items-center gap-2 px-1.5 pb-3 pt-1">
                <span className="size-2 rounded-full" style={{ background: stage.dot }} />
                <p className="text-[13px] font-semibold">{stage.label}</p>
                <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[10px] tabular text-subtle">
                  {items.length}
                </span>
                <span className="ml-auto font-mono text-[10.5px] tabular text-subtle">
                  {formatCompact(sum)}
                </span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {items.map(({ deal, contact, property }) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    onClick={() => {
                      if (!dragId && contact) setPreviewId(contact.id);
                    }}
                    title="Arraste para mover · clique para visão rápida do lead"
                    className={cn(
                      "cursor-grab rounded-xl border border-hairline bg-canvas p-3.5 transition-all duration-200 hover:border-hairline-strong hover:shadow-md active:cursor-grabbing",
                      dragId === deal.id && "rotate-2 opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft font-mono text-[10px] font-semibold text-subtle">
                        {contact ? initials(contact.name) : "—"}
                      </span>
                      <p className="truncate text-[13px] font-medium leading-tight">
                        {contact?.name ?? "Contato removido"}
                      </p>
                    </div>
                    {property && (
                      <p className="mt-2 truncate text-[11.5px] text-subtle">
                        <span className="font-mono text-[10px] uppercase tracking-wider">
                          {property.code}
                        </span>{" "}
                        · {property.title}
                      </p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between border-t border-hairline pt-2.5">
                      <span className="font-mono text-xs font-medium tabular">
                        {deal.value ? formatCompact(deal.value) : "—"}
                      </span>
                      {stage.id === "fechado" && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                          <Handshake className="size-3" />
                          fechado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <LeadDrawer contactId={previewId} onClose={() => setPreviewId(null)} />

      {/* Nova negociação */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nova negociação">
        <div className="space-y-4">
          <Field label="Contato">
            <Select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">Selecionar…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Imóvel de interesse">
            <Select
              value={form.propertyId}
              onChange={(e) => {
                const id = e.target.value;
                const p = properties.find((x) => x.id === id);
                setForm({ ...form, propertyId: id, value: p ? String(p.price) : form.value });
              }}
            >
              <option value="">A definir…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title} · {formatCompact(p.price)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input
                type="number"
                min={0}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="font-mono tabular"
              />
            </Field>
            <Field label="Estágio inicial">
              <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {DEAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="accent" loading={saving} onClick={createDeal}>
            Abrir negociação
          </Button>
        </div>
      </Modal>
    </div>
  );
}
