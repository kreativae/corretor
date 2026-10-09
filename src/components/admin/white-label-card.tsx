"use client";

import { Logo, Mark } from "@/components/brand";
import { Button, Field, Input } from "@/components/ui";
import type { WhiteLabel } from "@/lib/queries";
import { compressImage, MAX_UPLOAD_BYTES, sendFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

const ACCENTS = [
  { name: "Esmeralda", value: "#10b981" },
  { name: "Azul elétrico", value: "#4f7cff" },
  { name: "Laranja queimado", value: "#f26a1b" },
  { name: "Dourado grafite", value: "#d4a94e" },
  { name: "Vinho", value: "#b4325a" },
  { name: "Grafite", value: "#52525b" },
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

/** Prévia de como a marca aparece no cabeçalho, em fundo claro e escuro. */
function BrandPreview({ wl }: { wl: WhiteLabel }) {
  const shortName = wl.shortName.trim() || wl.orgName.trim().split(/\s+/)[0];
  const render = (dark: boolean) => {
    const logo = dark ? wl.logoDarkUrl || wl.logoUrl : wl.logoUrl || wl.logoDarkUrl;
    return (
      <div
        className={cn(
          "flex h-16 items-center rounded-xl border px-4",
          dark ? "border-white/10 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-900",
        )}
      >
        {logo ? (
          <Logo light={logo} alt={wl.orgName} />
        ) : (
          <span className="flex items-center gap-2.5">
            <Mark
              src={wl.iconUrl || undefined}
              className={dark ? "[&>rect]:fill-white/10" : "[&>rect]:fill-neutral-900"}
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
          style={{ background: wl.accent, color: "#0a0a0a" }}
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
    <section className="card-elev rounded-2xl border border-hairline bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            White label — identidade da marca
          </h2>
          <p className="mt-1 text-xs text-subtle">
            Aplicada ao site público, CRM, tela de login, ficha do imóvel e materiais exportados.
          </p>
        </div>
        <Button variant="accent" loading={saving} onClick={save}>
          <Check className="size-4" />
          Aplicar identidade
        </Button>
      </div>

      <div className="mt-6">
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
    </section>
  );
}
