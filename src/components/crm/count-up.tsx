"use client";

import { formatCompact } from "@/lib/utils";
import { useEffect, useRef } from "react";

function format(n: number, kind: "int" | "brl" | "pct") {
  const v = Math.round(n);
  return kind === "brl" ? formatCompact(v) : kind === "pct" ? `${v}%` : v.toLocaleString("pt-BR");
}

/**
 * Número que conta até o valor. O HTML já sai com o valor final (sem "0"
 * se o JS falhar) e a animação roda de novo sempre que o valor muda,
 * inclusive ao trocar filtros sem mudar de página.
 */
export function CountUp({ value, kind = "int" }: { value: number; kind?: "int" | "brl" | "pct" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = from.current;
    from.current = value;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(value, kind);
      return;
    }
    const t0 = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(2, -10 * p); // expo.out
      el.textContent = format(start + (value - start) * (p === 1 ? 1 : eased), kind);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = format(value, kind);
    };
  }, [value, kind]);

  return (
    <span ref={ref} suppressHydrationWarning>
      {format(value, kind)}
    </span>
  );
}
