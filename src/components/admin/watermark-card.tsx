"use client";

import { Button, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { WATERMARK_DEFAULTS, type WatermarkSettings } from "@/lib/watermark-settings";
import { ChevronDown, ImageIcon, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function Range({
  label,
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className={cn("block", disabled && "opacity-40")}>
      <span className="flex items-center justify-between text-xs text-subtle">
        {label}
        <span className="font-mono text-ink">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[rgb(var(--accent))]"
      />
    </label>
  );
}

function Row({
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", disabled && "opacity-40")}>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-subtle">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

/** Configurações › Marca d'água das fotos do site, com prévia real. */
export function WatermarkCard({
  initial,
  logoHint = "Carlos Amâncio · Imóveis",
}: {
  initial: WatermarkSettings;
  /** De onde vem o logo da marca d'água nesta empresa */
  logoHint?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wm, setWm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(wm) !== JSON.stringify(initial);
  const set = (p: Partial<WatermarkSettings>) => setWm((w) => ({ ...w, ...p }));

  // Prévia: espera o usuário parar de arrastar antes de pedir a imagem
  const [previewQs, setPreviewQs] = useState("");
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams(
        Object.entries(wm).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "1" : "0") : String(v)]),
      );
      setPreviewQs(q.toString());
    }, 350);
    return () => clearTimeout(t);
  }, [wm, open]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "watermark", value: wm }),
      });
      if (!res.ok) throw new Error();
      toast.success("Marca d'água salva. As fotos do site atualizam em até 1 hora.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const off = !wm.enabled;
  const summary = !initial.enabled
    ? "Desligada"
    : [initial.logo && "logotipo", initial.lines && (initial.linesCross ? "linhas cruzadas" : "linhas diagonais")]
        .filter(Boolean)
        .join(" + ") || "Sem elementos";

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-6 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <ImageIcon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold tracking-tight">Marca d&apos;água</span>
          <span className="mt-1 block max-w-xl text-xs text-subtle">
            {open
              ? "Proteção das fotos de imóveis no site, ficha e QR code. CRM, kits e portais recebem a foto original."
              : `${summary} — clique para ajustar`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-subtle transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="grid gap-6 border-t border-hairline p-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-5">
              <Row
                title="Aplicar marca d'água"
                hint="Liga ou desliga em todas as fotos do site"
                checked={wm.enabled}
                onChange={(v) => set({ enabled: v })}
              />
              <div className="space-y-4 rounded-xl border border-hairline p-4">
                <Row
                  title="Logotipo ao centro"
                  hint={logoHint}
                  checked={wm.logo}
                  disabled={off}
                  onChange={(v) => set({ logo: v })}
                />
                <Range label="Opacidade" value={wm.logoOpacity} min={10} max={90} suffix="%" disabled={off || !wm.logo} onChange={(v) => set({ logoOpacity: v })} />
                <Range label="Tamanho" value={wm.logoSize} min={15} max={60} suffix="% da foto" disabled={off || !wm.logo} onChange={(v) => set({ logoSize: v })} />
              </div>
              <div className="space-y-4 rounded-xl border border-hairline p-4">
                <Row
                  title="Linhas diagonais"
                  hint="Padrão fino sobre a foto inteira, como em bancos de imagens"
                  checked={wm.lines}
                  disabled={off}
                  onChange={(v) => set({ lines: v })}
                />
                <Row
                  title="Cruzadas"
                  hint="Duas direções (losangos) em vez de uma"
                  checked={wm.linesCross}
                  disabled={off || !wm.lines}
                  onChange={(v) => set({ linesCross: v })}
                />
                <Range label="Opacidade" value={wm.linesOpacity} min={5} max={50} suffix="%" disabled={off || !wm.lines} onChange={(v) => set({ linesOpacity: v })} />
                <Range label="Espaçamento" value={wm.linesSpacing} min={4} max={25} suffix="" disabled={off || !wm.lines} onChange={(v) => set({ linesSpacing: v })} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" loading={saving} disabled={!dirty} onClick={save}>
                  <Save className="size-4" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setWm(WATERMARK_DEFAULTS)}>
                  <RotateCcw className="size-4" />
                  Padrão
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">Prévia</p>
              <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-hairline bg-soft">
                {off ? (
                  <p className="absolute inset-0 grid place-items-center text-sm text-subtle">
                    Marca d&apos;água desligada
                  </p>
                ) : (
                  previewQs && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={previewQs}
                      src={`/api/watermark/preview?${previewQs}`}
                      alt="Prévia da marca d'água"
                      className="animate-fade-in absolute inset-0 h-full w-full object-cover"
                    />
                  )
                )}
              </div>
              <p className="mt-2 text-[11px] text-subtle">
                Usa a primeira foto cadastrada. Depois de salvar, as fotos do site atualizam em até 1 hora (cache).
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
