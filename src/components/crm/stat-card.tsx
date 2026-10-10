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
    <div className="card-elev rounded-2xl border border-hairline bg-card p-4 transition-colors md:p-5 duration-300 hover:border-hairline-strong">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
          {label}
        </p>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <p className="mt-3 whitespace-nowrap font-mono text-[22px] font-medium leading-none tabular tracking-tight md:mt-4 md:text-[28px]">
        <CountUp value={value} kind={format} />
        {suffix}
      </p>
      {caption && <p className="mt-2.5 text-xs text-subtle">{caption}</p>}
    </div>
  );
}
