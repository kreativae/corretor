"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Largura da folha A4 (210 mm) em pixels CSS */
const SHEET_PX = 794;

/**
 * Na tela, encolhe a folha A4 para caber inteira na largura (celular vê o
 * documento todo). Na impressão o zoom volta a 1 (ver .fit-sheet em globals.css).
 */
export function FitSheet({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 16) / SHEET_PX));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="fit-sheet" style={{ zoom: scale }}>
      {children}
    </div>
  );
}
