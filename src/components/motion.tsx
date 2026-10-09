"use client";

import { formatCompact } from "@/lib/utils";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ─────────────── Smooth scroll (Lenis) ─────────────── */

export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
  return null;
}

/* ─────────────── Scanner global de animações ───────────────
   Atributos reconhecidos:
   [data-reveal]     fade + translate ao entrar na viewport (data-delay opc.)
   [data-words]      título que revela palavra por palavra
   [data-counter]    contagem progressiva (data-format: int | brl | pct)
   [data-parallax]   parallax sutil em imagens (valor = amplitude %)
   [data-clip]       revelação por máscara (clip-path)
*/
export function MotionFX() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 30,
          opacity: 0,
          duration: 1,
          ease: "expo.out",
          delay: parseFloat(el.dataset.delay ?? "0"),
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-words]").forEach((el) => {
        if (!el.dataset.splitDone) {
          const words = el.textContent?.trim().split(/\s+/) ?? [];
          el.setAttribute("aria-label", words.join(" "));
          el.innerHTML = words
            .map(
              (w) =>
                `<span aria-hidden="true" class="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-top"><span class="word inline-block">${w}</span></span>`,
            )
            .join(" ");
          el.dataset.splitDone = "1";
        }
        gsap.from(el.querySelectorAll(".word"), {
          yPercent: 110,
          duration: 0.9,
          stagger: 0.05,
          ease: "expo.out",
          delay: parseFloat(el.dataset.delay ?? "0"),
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-counter]").forEach((el) => {
        const target = parseFloat(el.dataset.counter ?? "0");
        const format = el.dataset.format ?? "int";
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.8,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
          onUpdate: () => {
            const n = Math.round(obj.v);
            el.textContent =
              format === "brl"
                ? formatCompact(n)
                : format === "pct"
                  ? `${n}%`
                  : n.toLocaleString("pt-BR");
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const amt = parseFloat(el.dataset.parallax ?? "8");
        gsap.fromTo(
          el,
          { yPercent: amt },
          {
            yPercent: -amt,
            ease: "none",
            scrollTrigger: {
              trigger: el.parentElement ?? el,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-clip]").forEach((el) => {
        gsap.from(el, {
          clipPath: "inset(100% 0 0 0)",
          duration: 1.2,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 86%", once: true },
        });
      });
    });

    const t = setTimeout(() => ScrollTrigger.refresh(), 500);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, [pathname]);

  return null;
}
