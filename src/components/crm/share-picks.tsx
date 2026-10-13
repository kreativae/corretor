"use client";

import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

const PICKS = [30, 40, 50, 60];

/** Atalhos de repasse ao parceiro (% da comissão) */
export function SharePicks({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PICKS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(String(n))}
          aria-pressed={Number(value) === n}
          className={cn(
            "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
            Number(value) === n && value !== ""
              ? "border-transparent bg-ink text-canvas"
              : "border-hairline text-subtle hover:text-ink",
          )}
        >
          {n}%
        </button>
      ))}
    </div>
  );
}

/** Campo de percentual com sufixo fixo dentro do input ("% do imóvel", "% da comissão") */
export function PctInput({
  suffix,
  className,
  onChange,
  ...props
}: React.ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <span className="relative block">
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        {...props}
        onChange={(e) => {
          // Aceita vírgula ou ponto (5,5 → 5.5), só números e no máximo 100
          let v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
          v = v.replace(/(\..*)\./g, "$1");
          if (Number(v) > 100) v = "100";
          e.target.value = v;
          onChange?.(e);
        }}
        className={cn("pr-28 font-mono tabular", className)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-subtle">
        {suffix}
      </span>
    </span>
  );
}
