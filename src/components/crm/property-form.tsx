"use client";

import { Button, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { FEATURES, PURPOSE_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { PhotoManager } from "./photo-manager";
import { RuralFields } from "./rural-fields";
import { crmPropertyPath, isRuralType, normalizeRural, pricePerAlq, RURAL_TYPES, type RuralData } from "@/lib/rural";
import { cn, formatBRL } from "@/lib/utils";
import { ArrowLeft, Check, ImageIcon, Save, Sparkles } from "lucide-react";
import { generateDescription } from "@/lib/description";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const inputCls = "h-10";

export function PropertyForm({
  initial,
  kind,
}: {
  initial?: PropertyWithImages;
  /** Novo cadastro: urbano (padrão) ou rural. Na edição, vem do tipo. */
  kind?: "urbano" | "rural";
}) {
  const router = useRouter();
  const isEdit = !!initial;
  const rural = initial ? isRuralType(initial.type) : kind === "rural";
  const typeOptions = Object.entries(TYPE_LABELS).filter(
    ([k]) => isRuralType(k) === rural,
  );
  const [ruralData, setRuralData] = useState<RuralData>(() => normalizeRural(initial?.rural));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    type: initial?.type ?? (rural ? RURAL_TYPES[0] : "apartamento"),
    purpose: initial?.purpose ?? "venda",
    status: initial?.status ?? "disponivel",
    price: initial?.price?.toString() ?? "",
    condoFee: initial?.condoFee?.toString() ?? "",
    iptu: initial?.iptu?.toString() ?? "",
    area: initial?.area?.toString() ?? "",
    lotArea: initial?.lotArea?.toString() ?? "",
    bedrooms: initial?.bedrooms?.toString() ?? "0",
    suites: initial?.suites?.toString() ?? "0",
    bathrooms: initial?.bathrooms?.toString() ?? "0",
    garage: initial?.garage?.toString() ?? "0",
    street: initial?.street ?? "",
    neighborhood: initial?.neighborhood ?? "",
    city: initial?.city ?? (rural ? "" : "São Paulo"),
    state: initial?.state ?? (rural ? "PR" : "SP"),
    description: initial?.description ?? "",
    features: initial?.features ?? ([] as string[]),
    images: (initial?.images ?? []).map((i) => i.url),
    published: initial?.published ?? true,
  });

  const set = (k: string, v: string | boolean | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Cada clique gera um estilo diferente de texto
  const [variant, setVariant] = useState(0);
  function autoDescription() {
    if (
      form.description.trim() &&
      !window.confirm("Substituir a descrição atual pelo texto gerado?")
    ) {
      return;
    }
    const text = generateDescription(
      {
        type: form.type,
        purpose: form.purpose,
        area: Number(form.area) || 0,
        lotArea: form.lotArea ? Number(form.lotArea) : null,
        bedrooms: Number(form.bedrooms) || 0,
        suites: Number(form.suites) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        garage: Number(form.garage) || 0,
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        features: form.features,
        rural: rural ? ruralData : undefined,
      },
      variant,
    );
    set("description", text);
    setVariant((v) => v + 1);
    toast.success("Descrição gerada — revise e ajuste à vontade.");
  }

  const imageUrls = form.images;
  const setImages = (next: string[] | ((cur: string[]) => string[])) =>
    setForm((f) => ({ ...f, images: typeof next === "function" ? next(f.images) : next }));

  function toggleFeature(f: string) {
    setForm((cur) => ({
      ...cur,
      features: cur.features.includes(f)
        ? cur.features.filter((x) => x !== f)
        : [...cur.features, f],
    }));
  }

  async function submit() {
    if (rural) {
      if (!form.title.trim() || !form.price || !ruralData.totalAlq || !form.neighborhood.trim()) {
        toast.error("Preencha título, preço, área total e região.");
        return;
      }
    } else if (!form.title.trim() || !form.price || !form.area || !form.neighborhood.trim()) {
      toast.error("Preencha título, preço, área e bairro.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        purpose: form.purpose,
        status: form.status,
        price: Number(form.price),
        condoFee: form.condoFee ? Number(form.condoFee) : null,
        iptu: form.iptu ? Number(form.iptu) : null,
        area: Number(form.area),
        lotArea: form.lotArea ? Number(form.lotArea) : null,
        bedrooms: Number(form.bedrooms),
        suites: Number(form.suites),
        bathrooms: Number(form.bathrooms),
        garage: Number(form.garage),
        street: form.street,
        neighborhood: form.neighborhood.trim(),
        city: form.city,
        state: form.state,
        description: form.description,
        features: form.features,
        images: imageUrls,
        published: form.published,
        ...(rural
          ? {
              rural: ruralData,
              condoFee: null,
              iptu: null,
              lotArea: null,
              bedrooms: 0,
              suites: 0,
              bathrooms: 0,
              garage: 0,
              features: [],
            }
          : {}),
      };
      const res = await fetch(
        isEdit ? `/api/properties/${initial.id}` : "/api/properties",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(isEdit ? "Imóvel atualizado." : `Imóvel ${data.code} criado.`);
      router.push(crmPropertyPath(data));
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar. Verifique os campos.");
    } finally {
      setSaving(false);
    }
  }

  const sectionCls = "rounded-2xl border border-hairline bg-card p-6";
  const h2Cls = "mb-5 font-display text-base font-semibold tracking-tight";

  return (
    <div className="pb-24">
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:bg-soft hover:text-ink"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4.5" />
        </button>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
            {isEdit ? initial.code : "Cadastro"}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {rural
              ? isEdit
                ? "Editar propriedade rural"
                : "Nova propriedade rural"
              : isEdit
                ? "Editar imóvel"
                : "Novo imóvel"}
          </h1>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* Identificação */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>Identificação</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título do anúncio" className="sm:col-span-2">
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={
                    rural
                      ? "Ex.: Fazenda 120 alqueires dupla aptidão em Tamarana"
                      : "Ex.: Casa de vidro no Alto de Pinheiros"
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Tipo">
                <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {typeOptions.map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Finalidade">
                <Select value={form.purpose} onChange={(e) => set("purpose", e.target.value)}>
                  {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {rural ? (
            <RuralFields value={ruralData} onChange={setRuralData} />
          ) : (
            <>
          {/* Características */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>Características</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Área construída (m²)">
                <Input type="number" min={0} value={form.area} onChange={(e) => set("area", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Terreno (m²)">
                <Input type="number" min={0} value={form.lotArea} onChange={(e) => set("lotArea", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Quartos">
                <Input type="number" min={0} value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Suítes">
                <Input type="number" min={0} value={form.suites} onChange={(e) => set("suites", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Banheiros">
                <Input type="number" min={0} value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Vagas">
                <Input type="number" min={0} value={form.garage} onChange={(e) => set("garage", e.target.value)} className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Comodidades */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>
              Comodidades
              <span className="ml-2 font-mono text-[11px] font-normal text-subtle">
                {form.features.length} selecionadas
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {FEATURES.map((f) => {
                const on = form.features.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200",
                      on
                        ? "border-transparent bg-accent text-on-accent"
                        : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {f}
                  </button>
                );
              })}
            </div>
          </section>

            </>
          )}

          {/* Descrição */}
          <section className={sectionCls}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold tracking-tight">Descrição</h2>
              <Button type="button" variant="outline" size="sm" onClick={autoDescription}>
                <Sparkles className="size-3.5" />
                {variant ? "Gerar outra versão" : "Gerar descrição"}
              </Button>
            </div>
            <Textarea
              rows={9}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={
                rural
                  ? "Histórico da área, produtividade, sede, vizinhança, logística de escoamento…"
                  : "Conte a história do imóvel: luz, planta, reforma, vista…"
              }
            />
          </section>
        </div>

        <div className="space-y-5">
          {/* Valores */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>Valores</h2>
            <div className="space-y-4">
              <Field label={form.purpose === "aluguel" ? "Aluguel mensal (R$)" : "Preço de venda (R$)"}>
                <Input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="1.850.000" className={cn(inputCls, "font-mono tabular")} />
              </Field>
              {rural ? (
                <div className="rounded-xl bg-soft px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Preço por alqueire</p>
                  <p className="mt-1 font-mono text-lg tabular">
                    {(() => {
                      const v = pricePerAlq(Number(form.price) || 0, ruralData.totalAlq);
                      return v ? formatBRL(v) : "—";
                    })()}
                  </p>
                </div>
              ) : (
                <>
                  <Field label="Condomínio (R$/mês)">
                    <Input type="number" min={0} value={form.condoFee} onChange={(e) => set("condoFee", e.target.value)} className={cn(inputCls, "font-mono tabular")} />
                  </Field>
                  <Field label="IPTU (R$/ano)">
                    <Input type="number" min={0} value={form.iptu} onChange={(e) => set("iptu", e.target.value)} className={cn(inputCls, "font-mono tabular")} />
                  </Field>
                </>
              )}
            </div>
          </section>

          {/* Endereço */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>{rural ? "Localização" : "Endereço"}</h2>
            <div className="space-y-4">
              <Field label={rural ? "Estrada / acesso" : "Rua e número"}>
                <Input value={form.street} onChange={(e) => set("street", e.target.value)} className={inputCls} />
              </Field>
              <Field label={rural ? "Região / distrito / bairro rural" : "Bairro"}>
                <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <Field label="Cidade">
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </Field>
                <Field label="UF">
                  <Input value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={2} className={inputCls} />
                </Field>
              </div>
            </div>
          </section>

          {/* Fotos */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>
              Fotos
              <span className="ml-2 font-mono text-[11px] font-normal text-subtle">
                {imageUrls.length} {imageUrls.length === 1 ? "foto" : "fotos"}
              </span>
            </h2>
            <PhotoManager images={form.images} onChange={setImages} />
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
              <ImageIcon className="size-3.5" />
              A primeira foto vira a capa do anúncio.
            </p>
          </section>

          {/* Publicação */}
          <section className={sectionCls}>
            <h2 className={h2Cls}>Publicação</h2>
            <div className="space-y-4">
              <Field label="Status comercial">
                <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-xl bg-soft px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">Visível no site</p>
                  <p className="text-[11px] text-subtle">
                    Aparece na vitrine pública
                  </p>
                </div>
                <Switch
                  checked={form.published}
                  onChange={(v) => set("published", v)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-canvas/85 backdrop-blur-xl lg:pl-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 md:px-8">
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-subtle sm:block">
            {isEdit ? `Editando ${initial.code}` : "Código gerado automaticamente"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button variant="accent" loading={saving} onClick={submit}>
              <Save className="size-4" />
              {isEdit ? "Salvar alterações" : rural ? "Cadastrar propriedade" : "Cadastrar imóvel"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
