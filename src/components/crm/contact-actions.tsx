"use client";

import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import { CalendarPlus, Handshake, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function ContactActions({
  contactId,
  contactName,
  properties,
  linkedToGoogle,
  dealsCount,
  visitsCount,
}: {
  contactId: string;
  contactName: string;
  properties: { id: string; code: string; title: string; price: number }[];
  linkedToGoogle: boolean;
  dealsCount: number;
  visitsCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [value, setValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alsoGoogle, setAlsoGoogle] = useState(linkedToGoogle);

  function onSelectProperty(id: string) {
    setPropertyId(id);
    const p = properties.find((x) => x.id === id);
    if (p) setValue(String(p.price));
  }

  async function createDeal() {
    setSaving(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          propertyId: propertyId || null,
          value: value ? Number(value) : 0,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Negociação com ${contactName.split(" ")[0]} aberta no pipeline.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível criar a negociação.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/contacts/${contactId}${alsoGoogle && linkedToGoogle ? "?google=1" : ""}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.deletedInGoogle
          ? `${contactName} excluído do CRM e do Google Contacts.`
          : `${contactName} excluído do CRM.`,
      );
      router.push("/crm/contatos");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível excluir o contato.");
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5">
      <h3 className="font-display text-sm font-semibold tracking-tight">Ações</h3>
      <div className="mt-4 grid gap-2">
        <Button variant="accent" className="w-full" onClick={() => setOpen(true)}>
          <Handshake className="size-4" />
          Abrir negociação
        </Button>
        <Link href="/crm/agenda" className="block">
          <Button variant="outline" className="w-full">
            <CalendarPlus className="size-4" />
            Agendar visita
          </Button>
        </Link>
        <Button variant="danger" className="w-full" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          Excluir contato
        </Button>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir contato">
        <div className="space-y-4 text-sm">
          <p>
            Excluir <strong>{contactName}</strong> do CRM? Esta ação não pode ser desfeita.
          </p>
          {(dealsCount > 0 || visitsCount > 0) && (
            <p className="rounded-xl bg-red-500/10 p-3 text-red-500">
              Também serão apagadas{" "}
              {[
                dealsCount > 0 && `${dealsCount} negociação(ões)`,
                visitsCount > 0 && `${visitsCount} visita(s)`,
              ]
                .filter(Boolean)
                .join(" e ")}{" "}
              deste contato.
            </p>
          )}
          {linkedToGoogle ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-current"
                checked={alsoGoogle}
                onChange={(e) => setAlsoGoogle(e.target.checked)}
              />
              <span>
                <span className="font-medium">Apagar também no Google Contacts</span>
                <span className="mt-0.5 block text-xs text-subtle">
                  Se desmarcar, o contato continua no Google e pode voltar ao CRM na
                  próxima sincronização.
                </span>
              </span>
            </label>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={deleteContact}>
            Excluir
          </Button>
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova negociação">
        <div className="space-y-4">
          <Field label="Imóvel de interesse" hint="Opcional — pode definir depois">
            <Select value={propertyId} onChange={(e) => onSelectProperty(e.target.value)}>
              <option value="">A definir…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title} · {formatBRL(p.price)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor estimado (R$)">
            <Input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono tabular"
              placeholder="1.850.000"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="accent" loading={saving} onClick={createDeal}>
            Criar no pipeline
          </Button>
        </div>
      </Modal>
    </div>
  );
}
