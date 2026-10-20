"use client";

import { useEffect } from "react";

/**
 * Dificulta salvar as fotos do site: sem menu do botão direito, sem arrastar e sem o
 * "Salvar imagem" do toque longo no celular. Não impede print de tela; a proteção real é a
 * versão pública da foto (reduzida e com marca d'água), feita no servidor.
 */
export function ImageGuard() {
  useEffect(() => {
    const isImg = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === "IMG" || t.tagName === "PICTURE" || !!t.closest("[data-protect]"));
    const block = (e: Event) => {
      if (isImg(e.target)) e.preventDefault();
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
    };
  }, []);
  return null;
}
