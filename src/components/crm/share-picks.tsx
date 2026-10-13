"use client";

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
