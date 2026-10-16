import { commissionValues, type TaxBase } from "@/lib/partners";
import { cn, formatBRL } from "@/lib/utils";

/** Comissão, imposto, repasse e o que fica com a imobiliária (uso interno). */
export function CommissionBreakdown({
  price,
  commissionPct,
  partnerSharePct,
  taxPct,
  taxBase,
  className,
}: {
  price: number;
  commissionPct: number | null;
  /** null = imóvel próprio (sem repasse) */
  partnerSharePct: number | null;
  taxPct: number | null;
  taxBase: TaxBase | null;
  className?: string;
}) {
  const v = commissionValues(price, commissionPct, partnerSharePct, taxPct, taxBase);
  if (v.total == null || !price) return null;
  const taxRow = v.tax != null && (
    <Row
      label={`Imposto (${taxPct}% ${v.taxBase === "total" ? "da comissão" : "da parte da imobiliária"})`}
      value={`− ${formatBRL(v.tax)}`}
    />
  );
  return (
    <dl className={cn("space-y-1.5 text-sm", className)}>
      <Row label={`Comissão total (${commissionPct}% do imóvel)`} value={formatBRL(v.total)} />
      {v.taxBase === "total" && taxRow}
      {v.partner != null && (
        <Row
          label={`Repasse ao parceiro (${partnerSharePct}% da comissão${v.taxBase === "total" && v.tax != null ? " líquida" : ""})`}
          value={formatBRL(v.partner)}
        />
      )}
      {v.taxBase === "ours" && taxRow}
      <div className="flex justify-between gap-3 border-t border-hairline pt-1.5 font-medium">
        <dt>Fica com a imobiliária{v.tax != null ? " (líquido)" : ""}</dt>
        <dd className="shrink-0 font-mono tabular">{formatBRL(v.ours ?? 0)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className="shrink-0 font-mono tabular">{value}</dd>
    </div>
  );
}
