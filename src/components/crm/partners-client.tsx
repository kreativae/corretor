"use client";

import { Badge, Button, EmptyState, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import type { Partner } from "@/db/schema";
import { TYPE_LABELS } from "@/lib/labels";
import { PctInput, SharePicks } from "@/components/crm/share-picks";
import { CommissionBreakdown } from "@/components/crm/commission-breakdown";
import { commissionValues, PARTNER_WATERMARK, TAX_BASE, type PartnerWatermark, type TaxBase } from "@/lib/partners";
import { STATUS_LABELS } from "@/lib/labels";
import { crmPropertyPath } from "@/lib/rural";
import { formatBRL, formatPhone, plural } from "@/lib/utils";
import { Building2, Droplets, Eye, Handshake, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Row = Partner & { propertyCount: number; publishedCount: number };
type PartnerProperty = {
  id: string;
  code: string;
  title: string;
  type: string;
  price: number;
  published: boolean;
  partnerId: string;
  commissionPct: number | null;
  partnerSharePct: number | null;
  taxPct: number | null;
  taxBase: TaxBase | null;
  status: string;
};

/** Valores do imóvel com o imposto (base do imóvel ou, sem ajuste, a do parceiro) */
const valuesOf = (x: PartnerProperty, p: Row) =>
  commissionValues(x.price, x.commissionPct, x.partnerSharePct, x.taxPct, x.taxBase ?? (p.taxBase as TaxBase));

const EMPTY = {
  name: "",
  company: "",
  phone: "",
  email: "",
  creci: "",
  commissionPct: "",
  partnerSharePct: "",
  taxPct: "",
  taxBase: "total" as TaxBase,
  watermark: "padrao" as PartnerWatermark,
  notes: "",
};

export function PartnersClient({ partners, properties }: { partners: Row[]; properties: PartnerProperty[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const set = (p: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...p }));

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? partners.filter((p) =>
          [p.name, p.company, p.email, p.phone, p.creci].join(" ").toLowerCase().includes(t),
        )
      : partners;
  }, [partners, q]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(p: Row) {
    setEditing(p);
    setForm({
      name: p.name,
      company: p.company ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      creci: p.creci ?? "",
      commissionPct: p.commissionPct?.toString() ?? "",
      partnerSharePct: p.partnerSharePct?.toString() ?? "",
      taxPct: p.taxPct?.toString() ?? "",
      taxBase: (p.taxBase as TaxBase) ?? "total",
      watermark: p.watermark as PartnerWatermark,
      notes: p.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (form.name.trim().length < 2) return toast.error("Informe o nome do parceiro.");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/partners/${editing.id}` : "/api/partners", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      toast.success(editing ? "Parceiro atualizado." : "Parceiro cadastrado.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    const res = await fetch(`/api/partners/${toDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`${toDelete.name} excluído. Os imóveis continuam, sem vínculo.`);
      setToDelete(null);
      router.refresh();
    } else toast.error("Não foi possível excluir.");
  }

  const totalProps = properties.length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">Carteira de terceiros</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Parceiros</h1>
          <p className="mt-1 text-sm text-subtle">
            {partners.length} {plural(partners.length, "parceiro", "parceiros")} · {totalProps}{" "}
            {plural(totalProps, "imóvel de parceiro", "imóveis de parceiros")}
          </p>
        </div>
        <Button variant="accent" onClick={openNew}>
          <Plus className="size-4" />
          Novo parceiro
        </Button>
      </div>

      {partners.length > 0 && (
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, empresa, CRECI…" className="pl-10" />
        </div>
      )}

      {partners.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Handshake className="size-5" />}
            title="Nenhum parceiro ainda"
            description="Cadastre corretores e imobiliárias parceiras para vincular os imóveis que eles trazem, com a comissão combinada e a marca d'água de cada um."
            action={
              <Button variant="accent" onClick={openNew}>
                <Plus className="size-4" />
                Cadastrar parceiro
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {list.map((p) => {
            const props = properties.filter((x) => x.partnerId === p.id);
            return (
              <div key={p.id} className="card-elev rounded-2xl border border-hairline bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setViewing(p)} className="min-w-0 text-left">
                    <p className="truncate font-display text-lg font-semibold tracking-tight hover:underline">{p.name}</p>
                    <p className="truncate text-xs text-subtle">
                      {[p.company, p.creci && `CRECI ${p.creci}`].filter(Boolean).join(" · ") || "Parceiro"}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label="Visualizar" title="Visualizar" onClick={() => setViewing(p)}>
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(p)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setToDelete(p)}>
                      <Trash2 className="size-4 text-red-500/80" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-subtle">
                  {p.phone && (
                    <a href={`https://wa.me/55${p.phone.replace(/\D/g, "").replace(/^55/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Phone className="size-3.5" />
                      {formatPhone(p.phone)}
                    </a>
                  )}
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Mail className="size-3.5" />
                      {p.email}
                    </a>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>
                    Comissão {p.commissionPct != null ? `${p.commissionPct}%` : "—"}
                    {p.partnerSharePct != null && ` · repasse ${p.partnerSharePct}% da comissão`}
                  </Badge>
                  {p.taxPct != null && (
                    <Badge>
                      Imposto {p.taxPct}% · {p.taxBase === "ours" ? "sobre a nossa parte" : "sobre a comissão inteira"}
                    </Badge>
                  )}
                  <Badge>
                    <Droplets className="size-3" />
                    {PARTNER_WATERMARK[p.watermark as PartnerWatermark]}
                  </Badge>
                </div>

                <div className="mt-4 border-t border-hairline pt-3">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">
                    {props.length} {plural(props.length, "imóvel", "imóveis")} · {p.publishedCount} no site
                  </p>
                  {props.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {props.slice(0, 6).map((x) => {
                        const v = valuesOf(x, p);
                        return (
                          <li key={x.id}>
                            <Link
                              href={crmPropertyPath(x)}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-soft"
                            >
                              <Building2 className="size-3.5 shrink-0 text-subtle" />
                              <span className="font-mono text-[11px] text-subtle">{x.code}</span>
                              <span className="min-w-0 flex-1 truncate">{x.title}</span>
                              <span className="hidden text-[11px] text-subtle sm:inline">{TYPE_LABELS[x.type]}</span>
                              {v.partner != null && (
                                <span className="font-mono text-[11px] text-subtle" title="Repasse ao parceiro">
                                  {formatBRL(v.partner)}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                      {props.length > 6 && (
                        <li className="px-2 text-[11px] text-subtle">+ {props.length - 6} outros</li>
                      )}
                    </ul>
                  )}
                </div>
                {p.notes && <p className="mt-3 whitespace-pre-line text-xs text-subtle">{p.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar parceiro" : "Novo parceiro"} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nome do corretor" />
          </Field>
          <Field label="Imobiliária / empresa">
            <Input value={form.company} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" placeholder="(43) 99999-9999" />
          </Field>
          <Field label="CRECI">
            <Input value={form.creci} onChange={(e) => set({ creci: e.target.value })} />
          </Field>
          <Field label="E-mail" className="sm:col-span-2">
            <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Comissão">
            <PctInput suffix="% do imóvel" value={form.commissionPct} onChange={(e) => set({ commissionPct: e.target.value })} placeholder="6" />
          </Field>
          <div className="space-y-2">
            <Field label="Repasse ao parceiro">
              <PctInput suffix="% da comissão" value={form.partnerSharePct} onChange={(e) => set({ partnerSharePct: e.target.value })} placeholder="50" />
            </Field>
            <SharePicks value={form.partnerSharePct} onPick={(v) => set({ partnerSharePct: v })} />
          </div>
          <Field label="Imposto sobre a comissão">
            <PctInput suffix="%" value={form.taxPct} onChange={(e) => set({ taxPct: e.target.value })} placeholder="Sem imposto" />
          </Field>
          <Field label="O imposto incide sobre">
            <Select value={form.taxBase} onChange={(e) => set({ taxBase: e.target.value as TaxBase })}>
              {Object.entries(TAX_BASE).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marca d'água nas fotos dos imóveis dele" className="sm:col-span-2">
            <Select value={form.watermark} onChange={(e) => set({ watermark: e.target.value as PartnerWatermark })}>
              {Object.entries(PARTNER_WATERMARK).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observações (acordo, condições, contato…)" className="sm:col-span-2">
            <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-subtle">
          Comissão, repasse e imposto são o padrão para novos imóveis dele; dá para ajustar imóvel a imóvel.
          Comissão inteira: o imposto sai antes da divisão e o repasse é sobre o líquido. Só a nossa parte:
          cada um paga o seu imposto.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="accent" loading={saving} onClick={save}>
            {editing ? "Salvar" : "Cadastrar parceiro"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? "Parceiro"} wide>
        {viewing && (() => {
          const props = properties.filter((x) => x.partnerId === viewing.id);
          const sum = props.reduce(
            (acc, x) => {
              const v = valuesOf(x, viewing);
              return {
                total: acc.total + (v.total ?? 0),
                tax: acc.tax + (v.tax ?? 0),
                partner: acc.partner + (v.partner ?? 0),
                ours: acc.ours + (v.ours ?? 0),
              };
            },
            { total: 0, tax: 0, partner: 0, ours: 0 },
          );
          const info: [string, string | null][] = [
            ["Imobiliária / empresa", viewing.company],
            ["CRECI", viewing.creci],
            ["WhatsApp", viewing.phone ? formatPhone(viewing.phone) : null],
            ["E-mail", viewing.email],
            ["Comissão padrão", viewing.commissionPct != null ? `${viewing.commissionPct}% do imóvel` : null],
            ["Repasse padrão", viewing.partnerSharePct != null ? `${viewing.partnerSharePct}% da comissão` : null],
            [
              "Imposto padrão",
              viewing.taxPct != null ? `${viewing.taxPct}% · ${TAX_BASE[(viewing.taxBase as TaxBase) ?? "total"]}` : null,
            ],
            ["Marca d'água", PARTNER_WATERMARK[viewing.watermark as PartnerWatermark]],
          ];
          return (
            <div className="space-y-5">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {info.map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">{k}</dt>
                    <dd className="mt-0.5 text-sm">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              {viewing.notes && (
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">Observações</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{viewing.notes}</p>
                </div>
              )}
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
                  {props.length} {plural(props.length, "imóvel", "imóveis")} · {viewing.publishedCount} no site
                </p>
                {props.length === 0 ? (
                  <p className="mt-2 text-sm text-subtle">Nenhum imóvel vinculado a este parceiro.</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {props.map((x) => (
                      <li key={x.id} className="rounded-xl border border-hairline p-3">
                        <Link href={crmPropertyPath(x)} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm hover:underline">
                          <span className="font-mono text-[11px] text-subtle">{x.code}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{x.title}</span>
                          <span className="text-[11px] text-subtle">
                            {TYPE_LABELS[x.type]} · {STATUS_LABELS[x.status as keyof typeof STATUS_LABELS] ?? x.status} · {formatBRL(x.price)}
                          </span>
                        </Link>
                        <CommissionBreakdown
                          price={x.price}
                          commissionPct={x.commissionPct}
                          partnerSharePct={x.partnerSharePct}
                          taxPct={x.taxPct}
                          taxBase={x.taxBase ?? (viewing.taxBase as TaxBase)}
                          className="mt-2"
                        />
                        {x.commissionPct == null && <p className="mt-1 text-[11px] text-subtle">Sem comissão definida neste imóvel.</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {props.length > 1 && sum.total > 0 && (
                  <dl className="mt-3 space-y-1 rounded-xl bg-soft px-4 py-3 text-sm">
                    <p className="pb-1 font-medium">Somando todos os imóveis</p>
                    {(
                      [
                        ["Comissões", sum.total],
                        ["Impostos", sum.tax],
                        ["Repasses ao parceiro", sum.partner],
                        ["Fica com a imobiliária", sum.ours],
                      ] as const
                    )
                      .filter(([, n]) => n > 0)
                      .map(([k, n]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="text-subtle">{k}</dt>
                          <dd className="font-mono tabular">{formatBRL(n)}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setViewing(null)}>
                  Fechar
                </Button>
                <Button
                  variant="accent"
                  onClick={() => {
                    const p = viewing;
                    setViewing(null);
                    openEdit(p);
                  }}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir parceiro">
        <p className="text-sm text-subtle">
          Excluir <strong className="text-ink">{toDelete?.name}</strong>? Os imóveis dele continuam no sistema,
          apenas sem o vínculo de parceria.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="primary" className="bg-red-500 text-white hover:bg-red-600" onClick={remove}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
