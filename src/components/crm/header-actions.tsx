"use client";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Building2, Plus, RefreshCw, Tractor, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type SyncResult = {
  provider: string;
  pulled: number;
  pushed: number;
  removed: number;
  errors: string[];
};

const NAMES: Record<string, string> = {
  google_contacts: "Contatos",
  google_calendar: "Agenda",
};

/** Atalhos do topo do CRM: novos cadastros e sincronizar com o Google. */
export function HeaderActions() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [menu, setMenu] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha na sincronização");
      const lines = (data.results as SyncResult[]).map((r) => {
        const n = NAMES[r.provider] ?? r.provider;
        if (r.errors.length) return `${n}: ${r.errors[0]}`;
        const parts = [
          r.pulled && `${r.pulled} recebidos`,
          r.pushed && `${r.pushed} enviados`,
          r.removed && `${r.removed} removidos`,
        ].filter(Boolean);
        return `${n}: ${parts.length ? parts.join(", ") : "tudo em dia"}`;
      });
      (data.ok ? toast.success : toast.warning)("Google sincronizado", {
        description: lines.join(" · "),
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na sincronização");
    } finally {
      setSyncing(false);
    }
  }

  const items = [
    { href: "/crm/imoveis/novo", label: "Novo imóvel", icon: Building2 },
    { href: "/crm/propriedades/nova", label: "Nova propriedade", icon: Tractor },
    { href: "/crm/contatos?novo=1", label: "Novo contato", icon: UserPlus },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Computador: botões lado a lado */}
      <div className="hidden items-center gap-2 lg:flex">
        <Link href={items[0].href}>
          <Button variant="accent" size="sm" className="h-9">
            <Plus className="size-4" />
            Novo imóvel
          </Button>
        </Link>
        {items.slice(1).map((it) => (
          <Link key={it.href} href={it.href}>
            <Button variant="outline" size="sm" className="h-9">
              <it.icon className="size-4" />
              {it.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Celular/tablet: um botão + com o menu */}
      <div className="relative lg:hidden">
        <Button
          variant="accent"
          size="sm"
          className="h-9"
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          aria-label="Novo cadastro"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-hairline bg-card p-1 shadow-xl">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-soft"
                >
                  <it.icon className="size-4 text-subtle" />
                  {it.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={sync}
        disabled={syncing}
        aria-label="Sincronizar Google Contacts e Calendar"
        title="Sincronizar Google Contacts e Calendar"
      >
        <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
      </Button>
    </div>
  );
}
