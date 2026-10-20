"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/**
 * Menu de seções de um formulário longo: fica fixo abaixo do cabeçalho, leva até a seção e
 * marca a que está na tela enquanto a pessoa rola.
 */
export function SectionNav({ sections }: { sections: (readonly [string, string] | string[])[] }) {
  const [active, setActive] = useState(sections[0]?.[0] ?? "");
  const ids = sections.map((s) => s[0]).join(",");

  useEffect(() => {
    const els = ids.split(",").map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    // A seção "ativa" é a última cujo topo já passou da faixa logo abaixo do menu
    const onScroll = () => {
      const line = 150;
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      // No fim da página, marca a última (pode ser curta demais para chegar à linha)
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1].id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ids]);

  return (
    <nav
      aria-label="Seções do cadastro"
      className="sticky top-16 z-10 -mx-4 mb-5 overflow-x-auto border-b border-hairline bg-canvas/90 px-4 py-2.5 backdrop-blur-xl md:-mx-8 md:px-8"
    >
      <div className="flex gap-1.5">
        {sections.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              setActive(id);
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active === id ? "bg-ink text-canvas" : "text-subtle hover:bg-soft hover:text-ink",
            )}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
