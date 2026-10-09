"use client";

import { Badge, Button, Switch } from "@/components/ui";
import { PORTAL_STATUS_LABELS } from "@/lib/labels";
import type { Portal } from "@/db/schema";
import { cn, timeAgo } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const PORTAL_COLORS: Record<string, string> = {
  olx: "bg-purple-500/15 text-purple-400",
  zap: "bg-orange-500/15 text-orange-400",
  vivareal: "bg-blue-500/15 text-blue-400",
  quintoandar: "bg-emerald-500/15 text-emerald-400",
};

export function PortalPanel({
  portals,
  propertyCode,
}: {
  portals: Portal[];
  propertyCode: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(p: Portal, v: boolean) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/portals/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: v }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        v
          ? `${propertyCode} será enviado ao ${p.name} no próximo ciclo.`
          : `${propertyCode} removido do ${p.name}.`,
      );
      router.refresh();
    } catch {
      toast.error("Falha ao atualizar integração.");
    } finally {
      setBusy(null);
    }
  }

  async function sync(p: Portal) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/portals/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Sincronização com ${p.name} concluída.`);
      router.refresh();
    } catch {
      toast.error("Erro ao sincronizar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5">
      <h3 className="font-display text-sm font-semibold tracking-tight">
        Portais imobiliários
      </h3>
      <p className="mt-1 text-[11.5px] leading-relaxed text-subtle">
        Distribuição automática do anúncio via integração XML.
      </p>
      <div className="mt-4 space-y-2">
        {portals.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-3"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold uppercase",
                PORTAL_COLORS[p.slug] ?? "bg-soft text-subtle",
              )}
            >
              {p.name.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-tight">{p.name}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-subtle">
                {p.lastSyncAt
                  ? `sync ${timeAgo(p.lastSyncAt)} · ${p.listings} anúncios`
                  : "nunca sincronizado"}
              </p>
            </div>
            {p.enabled ? (
              <div className="flex items-center gap-1.5">
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                  {PORTAL_STATUS_LABELS[p.status]}
                </Badge>
                <Switch checked onChange={(v) => toggle(p, v)} disabled={busy === p.id} />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                loading={busy === p.id}
                onClick={() => toggle(p, true)}
              >
                Ativar
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full justify-center text-xs"
        onClick={() => portals.filter((p) => p.enabled).forEach(sync)}
        disabled={!portals.some((p) => p.enabled) || busy !== null}
      >
        <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        Sincronizar tudo agora
      </Button>
    </div>
  );
}
