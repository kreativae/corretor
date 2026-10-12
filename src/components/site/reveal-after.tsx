"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Mostra o conteúdo (ex.: barra fixa do celular) só depois que o elemento
 * `targetId` já passou para cima da tela — antes disso ele mesmo está visível.
 */
export function RevealAfter({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => setShow(!e.isIntersecting && e.boundingClientRect.bottom < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={cn(
        "transition-all duration-500 ease-expo",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
