"use client";

import { Button, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Botão + confirmação para excluir o contato (e, opcionalmente, no Google). */
export function DeleteContactButton({
  contactId,
  contactName,
  linkedToGoogle,
  dealsCount,
  visitsCount,
  onDeleted,
  className,
}: {
  contactId: string;
  contactName: string;
  linkedToGoogle: boolean;
  dealsCount: number;
  visitsCount: number;
  onDeleted: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alsoGoogle, setAlsoGoogle] = useState(true);

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
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Não foi possível excluir o contato.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="danger"
        className={cn("w-full", className)}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        Excluir contato
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Excluir contato">
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
          {linkedToGoogle && (
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
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deleting} onClick={deleteContact}>
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  );
}
