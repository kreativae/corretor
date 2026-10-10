"use client";

import { Logo, Mark } from "@/components/brand";
import { Button, Field, Input } from "@/components/ui";
import type { WhiteLabel } from "@/lib/queries";
import { compressImage, MAX_UPLOAD_BYTES, sendFile } from "@/lib/upload-client";
import { cn, onAccentColor } from "@/lib/utils";
import { ArrowUpRight, Check, ChevronDown, ImagePlus, Loader2, Palette, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

const ACCENTS = [
  { name: "Laranja da marca", value: "#f47525" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Azul elétrico", value: "#4f7cff" },
  { name: "Laranja queimado", value: "#f26a1b" },
  { name: "Dourado grafite", value: "#d4a94e" },
  { name: "Vinho", value: "#b4325a" },
  { name: "Grafite", value: "#52525b" },
];

const ON_ACCENTS = [
  { name: "Branco", value: "#ffffff" },
  { name: "Marinho da marca", value: "#1c1c45" },
  { name: "Preto", value: "#0a0a0a" },
];

const h3 = "font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle";

/** Campo de imagem da marca: prévia, envio e remoção. */
function BrandImageField({
  label,
  hint,
  value,
  onChange,
  dark,
  square,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  dark?: boolean;
  square?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast.error("Envie PNG, JPG ou WebP. Para logos, prefira PNG com fundo transparente.");
      return;
    }
    setProgress(0);
    try {
      // Logos: mantém o arquivo original; só reduz se passar do limite
      const ready = file.size > 1.5 * 1024 * 1024 ? await compressImage(file) : file;
      if (ready.size > MAX_UPLOAD_BYTES) throw new Error("Arquivo acima de 4 MB.");
      onChange(await sendFile(ready, setProgress, "marca"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-subtle">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "flex h-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-hairline-strong transition-colors hover:border-ink",
            square ? "w-20" : "w-44",
            dark ? "bg-neutral-900" : "bg-white",
          )}
        >
          {progress !== null ? (
            <span className="flex flex-col items-center gap-1 text-[11px] text-neutral-400">
              <Loader2 className="size-4 animate-spin" />
              {Math.round(progress)}%
            </span>
          ) : value ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={value}
              alt=""
              className={cn("max-h-full max-w-full object-contain", square ? "size-full object-cover" : "p-3")}
            />
          ) : (
            <ImagePlus className="size-5 text-neutral-400" />
          )}
        </button>
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] leading-snug text-subtle">{hint}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
              {value ? "Trocar" : "Enviar"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
                <Trash2 className="size-3.5" />
                Remover
              </Button>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-hairline p-3.5 transition-colors hover:bg-soft">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-[11px] text-subtle">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-hairline-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

/** Prévia de como a marca aparece no cabeçalho, em fundo claro e escuro. */
function BrandPreview({ wl }: { wl: WhiteLabel }) {
  const shortName = wl.shortName.trim() || wl.orgName.trim().split(/\s+/)[0];
  const render = (dark: boolean) => {
    const logo = dark ? wl.logoDarkUrl || wl.logoUrl : wl.logoUrl || wl.logoDarkUrl;
    return (
      <div
        className={cn(
          "flex h-16 items-center rounded-xl border px-4",
          dark ? "border-white/10 bg-[#11112a] text-white" : "border-neutral-200 bg-white text-neutral-900",
        )}
      >
        {logo ? (
          <Logo light={logo} alt={wl.orgName} />
        ) : (
          <span className="flex items-center gap-2.5">
            <Mark
              src={wl.iconUrl || undefined}
              className={dark ? "text-white" : "text-[#2B2B5D]"}
            />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-semibold tracking-tight">{shortName}</span>
              {wl.brandSub && (
                <span
                  className={cn(
                    "mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.22em]",
                    dark ? "text-white/50" : "text-neutral-500",
                  )}
                >
                  {wl.brandSub}
                </span>
              )}
            </span>
          </span>
        )}
        <span
          className="ml-auto rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: wl.accent, color: onAccentColor(wl.accent, wl.onAccent) }}
        >
          Agendar visita
        </span>
      </div>
    );
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {render(false)}
      {render(true)}
    </div>
  );
}

export function WhiteLabelCard({ initial }: { initial: WhiteLabel }) {
  const router = useRouter();
  const [wl, setWl] = useState(initial);
  const [saving, setSaving] = useState(false);
  // Fica recolhido (sanfona); o editor abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const dirty = JSON.stringify(wl) !== JSON.stringify(initial);
  const set = <K extends keyof WhiteLabel>(k: K, v: WhiteLabel[K]) =>
    setWl((cur) => ({ ...cur, [k]: v }));

  async function save() {
    if (!wl.orgName.trim()) {
      toast.error("Informe o nome da organização.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "whiteLabel", value: wl }),
      });
      if (!res.ok) throw new Error();
      toast.success("Identidade aplicada em toda a plataforma.");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar identidade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <div className="flex flex-wrap items-center gap-3 p-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
            <Palette className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-semibold tracking-tight">
              White label — identidade da marca
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs text-subtle">
              <span
                className="size-3 shrink-0 rounded-full border border-hairline"
                style={{ background: wl.accent }}
                aria-hidden
              />
              <span className="truncate">
                {open
                  ? "Aplicada ao site público, CRM, tela de login, ficha do imóvel e materiais exportados."
                  : `${wl.orgName}${wl.domain ? ` · ${wl.domain}` : ""} — clique para editar`}
              </span>
            </span>
          </span>
        </button>
        {(open || dirty) && (
          <Button variant="accent" loading={saving} onClick={save}>
            <Check className="size-4" />
            Aplicar identidade
          </Button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Recolher editor" : "Abrir editor"}
          className="rounded-full p-2 text-subtle transition-colors hover:bg-soft hover:text-ink"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
        </button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
      <div className="min-h-0 overflow-hidden" inert={!open}>
      <div className="border-t border-hairline px-6 pb-6 pt-6">
      <div>
        <p className={cn(h3, "mb-3")}>Prévia</p>
        <BrandPreview wl={wl} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Identidade */}
        <div className="space-y-4">
          <p className={h3}>Identidade</p>
          <Field label="Nome da organização" hint="Usado em títulos, rodapé e ficha">
            <Input value={wl.orgName} onChange={(e) => set("orgName", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome curto" hint="Ao lado do ícone">
              <Input
                value={wl.shortName}
                placeholder={wl.orgName.split(" ")[0]}
                onChange={(e) => set("shortName", e.target.value)}
              />
            </Field>
            <Field label="Subtítulo" hint="Abaixo do nome curto">
              <Input value={wl.brandSub} onChange={(e) => set("brandSub", e.target.value)} />
            </Field>
          </div>
          <Field label="Slogan" hint="Tela de login e materiais">
            <Input value={wl.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-subtle">Cor de destaque</span>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  title={a.name}
                  onClick={() => set("accent", a.value)}
                  className={cn(
                    "size-9 rounded-full border-2 transition-transform duration-200 hover:scale-110",
                    wl.accent.toLowerCase() === a.value ? "border-ink" : "border-transparent",
                  )}
                  style={{ background: a.value }}
                />
              ))}
              <input
                type="color"
                value={wl.accent}
                onChange={(e) => set("accent", e.target.value)}
                className="size-9 cursor-pointer rounded-full border border-hairline bg-transparent"
                aria-label="Cor personalizada"
              />
              <code className="font-mono text-xs text-subtle">{wl.accent}</code>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-subtle">
              Cor do texto no destaque
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => set("onAccent", "")}
                className={cn(
                  "h-9 rounded-full border-2 px-3.5 text-xs font-medium transition-colors",
                  !wl.onAccent ? "border-ink text-ink" : "border-hairline text-subtle hover:text-ink",
                )}
              >
                Automática
              </button>
              {ON_ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  title={a.name}
                  onClick={() => set("onAccent", a.value)}
                  className={cn(
                    "size-9 rounded-full border-2 ring-1 ring-hairline transition-transform duration-200 hover:scale-110",
                    wl.onAccent.toLowerCase() === a.value ? "border-ink" : "border-transparent",
                  )}
                  style={{ background: a.value }}
                />
              ))}
              <input
                type="color"
                value={onAccentColor(wl.accent, wl.onAccent)}
                onChange={(e) => set("onAccent", e.target.value)}
                className="size-9 cursor-pointer rounded-full border border-hairline bg-transparent"
                aria-label="Cor personalizada do texto"
              />
              {/* Prévia: um botão como os do site */}
              <span
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium"
                style={{ background: wl.accent, color: onAccentColor(wl.accent, wl.onAccent) }}
              >
                Falar com corretor
                <ArrowUpRight className="size-3.5" />
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-subtle">
              Texto e ícones dos botões e selos na cor de destaque. &ldquo;Automática&rdquo; escolhe o de melhor leitura.
            </p>
          </div>
        </div>

        {/* Logos */}
        <div className="space-y-5">
          <p className={h3}>Logos</p>
          <BrandImageField
            label="Logo principal"
            hint="Horizontal, para fundos claros. Substitui ícone + nome no cabeçalho."
            value={wl.logoUrl}
            onChange={(v) => set("logoUrl", v)}
          />
          <BrandImageField
            label="Logo para fundo escuro"
            hint="Opcional. Usada no tema escuro do site e do sistema."
            value={wl.logoDarkUrl}
            onChange={(v) => set("logoDarkUrl", v)}
            dark
          />
          <BrandImageField
            label="Ícone"
            hint="Quadrado, mín. 512×512. Favicon, aba do navegador e selo da marca."
            value={wl.iconUrl}
            onChange={(v) => set("iconUrl", v)}
            square
          />
        </div>

        {/* Ficha */}
        <div className="space-y-3 lg:col-span-2">
          <p className={h3}>Ficha do imóvel</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle
              label="Mostrar ícone"
              hint="Selo ao lado do nome, no cabeçalho da ficha"
              checked={wl.fichaShowIcon}
              onChange={(v) => set("fichaShowIcon", v)}
            />
            <Toggle
              label="Mostrar nome"
              hint="Nome da organização no cabeçalho da ficha"
              checked={wl.fichaShowName}
              onChange={(v) => set("fichaShowName", v)}
            />
            <Toggle
              label="Mostrar domínio"
              hint="Endereço do site no cabeçalho e no rodapé da ficha"
              checked={wl.fichaShowDomain}
              onChange={(v) => set("fichaShowDomain", v)}
            />
          </div>
          <p className="text-[11px] text-subtle">
            Com a logo principal enviada, ela substitui ícone e nome no cabeçalho da ficha.
          </p>
        </div>

        {/* Contato */}
        <div className="space-y-4 lg:col-span-2">
          <p className={h3}>Contato e presença</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp comercial" hint="DDI + DDD + número, só dígitos">
              <Input
                value={wl.phone}
                inputMode="tel"
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                className="font-mono tabular"
              />
            </Field>
            <Field label="E-mail de contato">
              <Input
                type="email"
                value={wl.email}
                placeholder="contato@suaimobiliaria.com.br"
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Domínio do site" hint="Sem https://">
              <Input value={wl.domain} onChange={(e) => set("domain", e.target.value)} />
            </Field>
            <Field label="Instagram" hint="@usuario">
              <Input
                value={wl.instagram}
                placeholder="@suaimobiliaria"
                onChange={(e) => set("instagram", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>
      </div>
      </div>
      </div>
    </section>
  );
}
