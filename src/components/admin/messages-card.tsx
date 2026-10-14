"use client";

import { Button, Input, Textarea } from "@/components/ui";
import {
  fillMessage,
  MESSAGE_DEFAULTS,
  MESSAGE_GROUPS,
  type MessageKey,
  type Messages,
} from "@/lib/messages";
import { cn } from "@/lib/utils";
import { ChevronDown, MessagesSquare, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Valores de exemplo para a prévia */
const SAMPLE: Record<string, string> = {
  codigo: "NRD-2401",
  titulo: "Apartamento com vista para o lago",
  preco: "R$ 1.850.000",
  nome: "Maria Souza",
  primeiro_nome: "Maria",
  quantidade: "3",
  corretor: "Carlos Amâncio",
  interesse: "Apartamento",
  origem: "Formulário do site",
};

/** Mensagens automáticas: WhatsApp, e-mail da Negociação e aviso de lead. */
export function MessagesCard({ initial }: { initial: Messages }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(msgs) !== JSON.stringify(saved);
  const customized = (Object.keys(MESSAGE_DEFAULTS) as MessageKey[]).filter(
    (k) => msgs[k] !== MESSAGE_DEFAULTS[k],
  ).length;

  const set = (k: MessageKey, v: string) => setMsgs((cur) => ({ ...cur, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "messages", value: msgs }),
      });
      if (!res.ok) throw new Error();
      // Campo vazio volta ao padrão no servidor
      const clean = Object.fromEntries(
        (Object.keys(MESSAGE_DEFAULTS) as MessageKey[]).map((k) => [k, msgs[k].trim() ? msgs[k] : MESSAGE_DEFAULTS[k]]),
      ) as Messages;
      setMsgs(clean);
      setSaved(clean);
      toast.success("Mensagens salvas.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar.");
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
            <MessagesSquare className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-semibold tracking-tight">Mensagens e e-mails</span>
            <span className={cn("mt-1 block max-w-xl text-xs text-subtle", !open && "truncate")}>
              {open
                ? "Textos automáticos do sistema: WhatsApp do site, e-mail ao cliente e aviso de novos leads. Use as variáveis entre chaves."
                : customized
                  ? `${customized} ${customized === 1 ? "mensagem personalizada" : "mensagens personalizadas"} — clique para editar`
                  : "Usando os textos padrão — clique para ver e editar"}
            </span>
          </span>
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <Button variant="accent" size="sm" onClick={save} loading={saving} disabled={!dirty}>
            <Save className="size-4" />
            Salvar
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-8 border-t border-hairline p-6">
          {MESSAGE_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">{g.title}</p>
              <p className="mt-1 text-xs text-subtle">{g.desc}</p>
              <div className="mt-4 space-y-5">
                {g.items.map((it) => {
                  const value = msgs[it.key];
                  const isDefault = value === MESSAGE_DEFAULTS[it.key];
                  const preview = fillMessage(value || MESSAGE_DEFAULTS[it.key], SAMPLE);
                  return (
                    <div key={it.key} className="rounded-xl border border-hairline p-4">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{it.label}</p>
                          <p className="text-[11px] text-subtle">{it.where}</p>
                        </div>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => set(it.key, MESSAGE_DEFAULTS[it.key])}
                            className="inline-flex items-center gap-1 text-[11px] text-subtle hover:text-ink"
                          >
                            <RotateCcw className="size-3" /> Restaurar padrão
                          </button>
                        )}
                      </div>
                      {it.multiline ? (
                        <Textarea rows={3} value={value} onChange={(e) => set(it.key, e.target.value)} />
                      ) : (
                        <Input value={value} onChange={(e) => set(it.key, e.target.value)} />
                      )}
                      {it.vars.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-subtle">Inserir:</span>
                          {it.vars.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => set(it.key, `${value}${value && !value.endsWith(" ") ? " " : ""}{${v}}`)}
                              className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10.5px] text-subtle hover:bg-soft hover:text-ink"
                            >
                              {`{${v}}`}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-soft px-3 py-2 text-xs text-subtle">
                        <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider">Prévia</span>
                        {preview}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button variant="accent" onClick={save} loading={saving} disabled={!dirty}>
              <Save className="size-4" />
              Salvar mensagens
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
