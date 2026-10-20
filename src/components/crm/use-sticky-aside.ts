"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Coluna lateral fixa ao rolar. Se couber na tela, gruda no topo (`top`);
 * se for mais alta, rola junto com a página e gruda quando o fim aparece
 * (acima da barra de salvar), sem rolagem interna.
 */
export function useStickyAside(top = 128, bottom = 96) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(top);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const free = window.innerHeight - bottom;
      const h = el.offsetHeight;
      setOffset(top + h <= free ? top : free - h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [top, bottom]);

  return { ref, style: { top: offset } } as const;
}
