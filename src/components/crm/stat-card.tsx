import { CountUp } from "@/components/crm/count-up";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  format = "int",
  suffix = "",
  caption,
  icon,
}: {
  label: string;
  value: number;
  format?: "int" | "brl" | "pct";
  suffix?: string;
  caption?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card-elev rounded-2xl border border-hairline bg-card p-5 transition-colors duration-300 hover:border-hairline-strong">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
          {label}
        </p>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <p className="mt-4 font-mono text-[28px] font-medium leading-none tabular tracking-tight">
        <CountUp value={value} kind={format} />
        {suffix}
      </p>
      {caption && <p className="mt-2.5 text-xs text-subtle">{caption}</p>}
    </div>
  );
}
