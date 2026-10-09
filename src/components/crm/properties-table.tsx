"use client";

import { Badge, Button, Input, Modal, Select, Switch } from "@/components/ui";
import {
  PURPOSE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_LABELS,
} from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import {
  APTIDAO_LABELS,
  crmPropertyPath,
  formatAlq,
  isRuralType,
  normalizeRural,
  pricePerAlq,
} from "@/lib/rural";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import {
  ArrowUpRight,
  Building2,
  Eye,
  Pencil,
  Plus,
  Search,
  Tractor,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function PropertiesTable({
  initial,
  viewCounts = {},
  kind = "urbano",
}: {
  initial: PropertyWithImages[];
  viewCounts?: Record<string, { total: number; unique: number }>;
  kind?: "urbano" | "rural";
}) {
  const rural = kind === "rural";
  const noun = rural ? "propriedades" : "imóveis";
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [toDelete, setToDelete] = useState<PropertyWithImages | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = items;
    if (status !== "all") list = list.filter((p) => p.status === status);
    if (type !== "all") list = list.filter((p) => p.type === type);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(t) ||
          p.code.toLowerCase().includes(t) ||
          p.neighborhood.toLowerCase().includes(t),
      );
    }
    return list;
  }, [items, q, status, type]);

  async function togglePublished(p: PropertyWithImages, v: boolean) {
    setItems((arr) =>
      arr.map((x) => (x.id === p.id ? { ...x, published: v } : x)),
    );
    try {
      const res = await fetch(`/api/properties/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: v }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        v ? `${p.code} publicado no site` : `${p.code} removido da vitrine`,
      );
      router.refresh();
    } catch {
      setItems((arr) =>
        arr.map((x) => (x.id === p.id ? { ...x, published: !v } : x)),
      );
      toast.error("Não foi possível atualizar a publicação.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setItems((arr) => arr.filter((x) => x.id !== toDelete.id));
      toast.success(`${toDelete.code} excluído do portfólio.`);
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir imóvel.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={rural ? "Buscar por código, título ou região…" : "Buscar por código, título ou bairro…"}
            className="pl-10"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
          <option value="all">Todos os tipos</option>
          {Object.entries(TYPE_LABELS)
            .filter(([k]) => isRuralType(k) === rural)
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
        <Link href={rural ? "/crm/propriedades/nova" : "/crm/imoveis/novo"}>
          <Button variant="primary" size="md">
            <Plus className="size-4" />
            {rural ? "Nova propriedade" : "Novo imóvel"}
          </Button>
        </Link>
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
        {filtered.length} de {items.length} {noun}
      </p>

      {/* Tabela */}
      <div className="card-elev mt-3 overflow-x-auto rounded-2xl border border-hairline bg-card">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              <th className="px-5 py-3.5 font-medium">{rural ? "Propriedade" : "Imóvel"}</th>
              <th className="px-4 py-3.5 font-medium">Tipo</th>
              <th className="px-4 py-3.5 font-medium">{rural ? "Aptidão" : "Finalidade"}</th>
              <th className="px-4 py-3.5 text-right font-medium">Área</th>
              <th className="px-4 py-3.5 text-right font-medium">Preço</th>
              <th className="px-4 py-3.5 text-right font-medium">Views</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 text-center font-medium">Site</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="group border-b border-hairline/60 transition-colors last:border-0 hover:bg-soft/50"
              >
                <td className="px-5 py-3">
                  <Link
                    href={crmPropertyPath(p)}
                    className="flex items-center gap-3.5"
                  >
                    <span className="relative block size-11 shrink-0 overflow-hidden rounded-lg bg-soft">
                      {p.cover ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.cover}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        rural ? (
                          <Tractor className="absolute inset-0 m-auto size-4 text-subtle" />
                        ) : (
                          <Building2 className="absolute inset-0 m-auto size-4 text-subtle" />
                        )
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-64 truncate font-medium leading-tight group-hover:underline group-hover:underline-offset-4">
                        {p.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                        {p.code} · {p.neighborhood}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-subtle">{TYPE_LABELS[p.type]}</td>
                <td className="px-4 py-3 text-subtle">
                  {rural
                    ? (() => {
                        const apt = normalizeRural(p.rural).aptidao;
                        return apt ? APTIDAO_LABELS[apt] : "—";
                      })()
                    : PURPOSE_LABELS[p.purpose]}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular text-subtle">
                  {rural
                    ? `${formatAlq(normalizeRural(p.rural).totalAlq ?? 0)} alq`
                    : `${formatNumber(p.area)} m²`}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium tabular">
                  {formatBRL(p.price)}
                  {rural && pricePerAlq(p.price, normalizeRural(p.rural).totalAlq) && (
                    <span className="block text-[10.5px] font-normal text-subtle">
                      {formatBRL(pricePerAlq(p.price, normalizeRural(p.rural).totalAlq))}/alq
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    title={
                      viewCounts[p.id]
                        ? `${viewCounts[p.id].total} visualizações · ${viewCounts[p.id].unique} visitantes únicos`
                        : "Sem visualizações registradas"
                    }
                    className="inline-flex items-center gap-1.5 font-mono text-xs tabular text-subtle"
                  >
                    <Eye className="size-3.5" />
                    {viewCounts[p.id]?.total ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn("border", STATUS_STYLES[p.status])}>
                    {STATUS_LABELS[p.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <Switch
                      checked={p.published}
                      onChange={(v) => togglePublished(p, v)}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link href={crmPropertyPath(p, "/editar")}>
                      <Button variant="ghost" size="icon" aria-label="Editar">
                        <Pencil className="size-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      onClick={() => setToDelete(p)}
                    >
                      <Trash2 className="size-4 text-red-500/80" />
                    </Button>
                    <Link href={crmPropertyPath(p)}>
                      <Button variant="ghost" size="icon" aria-label="Abrir">
                        <ArrowUpRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-14 text-center text-sm text-subtle">
            {rural
              ? items.length
                ? "Nenhuma propriedade com esses filtros."
                : "Nenhuma propriedade rural cadastrada ainda."
              : "Nenhum imóvel com esses filtros."}
          </p>
        )}
      </div>

      {/* Confirmação de exclusão */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir imóvel"
      >
        <p className="text-sm leading-relaxed text-subtle">
          Tem certeza que deseja excluir{" "}
          <span className="font-medium text-ink">
            {toDelete?.code} — {toDelete?.title}
          </span>
          ? Fotos, visitas e histórico vinculados serão removidos. Esta ação não
          pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deleting} onClick={confirmDelete}>
            Excluir definitivamente
          </Button>
        </div>
      </Modal>
    </div>
  );
}
