"use client";

import { Button } from "@/components/ui";
import { crmPropertyPath } from "@/lib/rural";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Duplica o anúncio (fora do site, mesmas fotos) e abre a cópia para edição. */
export function DuplicatePropertyButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function duplicate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      const copy = (await res.json()) as { id: string; code: string; type: string };
      toast.success(`${code} duplicado como ${copy.code} (fora do site).`);
      router.push(crmPropertyPath(copy, "/editar"));
    } catch {
      toast.error("Não foi possível duplicar.");
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={duplicate} title="Duplicar anúncio">
      <Copy className="size-3.5" />
      Duplicar
    </Button>
  );
}
