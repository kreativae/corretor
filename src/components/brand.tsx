"use client";

import { Monogram } from "@/components/monogram";
import { cn } from "@/lib/utils";
import { createContext, useContext, type ReactNode } from "react";

/** Identidade visual vinda do white label (definida no layout raiz). */
export type Brand = {
  orgName: string;
  shortName: string;
  sub: string;
  logoUrl: string;
  logoDarkUrl: string;
  iconUrl: string;
};

const BrandContext = createContext<Brand>({
  orgName: "",
  shortName: "",
  sub: "",
  logoUrl: "",
  logoDarkUrl: "",
  iconUrl: "",
});

export function BrandProvider({ value, children }: { value: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}

/** Selo da marca — ícone enviado no white label ou o monograma da identidade. */
export function Mark({ className, src }: { className?: string; src?: string }) {
  const brand = useBrand();
  const icon = src ?? brand.iconUrl;
  if (icon) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={icon}
        alt=""
        aria-hidden
        className={cn("size-7 shrink-0 rounded-[22%] object-cover", className)}
      />
    );
  }
  return <Monogram className={cn("size-7 text-ink", className)} tip="rgb(var(--accent))" />;
}

/** Logo horizontal; alterna a versão para fundo escuro no tema dark. */
export function Logo({
  className,
  light,
  dark,
  alt,
}: {
  className?: string;
  light: string;
  dark?: string;
  alt: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={light}
        alt={alt}
        className={cn("h-8 w-auto max-w-[180px] object-contain", dark && "dark:hidden", className)}
      />
      {dark && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={dark}
          alt={alt}
          className={cn("hidden h-8 w-auto max-w-[180px] object-contain dark:block", className)}
        />
      )}
    </>
  );
}

/**
 * Marca completa: logo enviada (se houver) ou ícone + nome curto + subtítulo.
 * `name`/`sub` sobrescrevem os valores do white label.
 */
export function Wordmark({
  name,
  sub,
  className,
  invert,
}: {
  name?: string;
  sub?: string;
  className?: string;
  invert?: boolean;
}) {
  const brand = useBrand();
  if (brand.logoUrl || brand.logoDarkUrl) {
    return (
      <span className={cn("flex items-center", className)}>
        <Logo
          light={brand.logoUrl || brand.logoDarkUrl}
          dark={brand.logoDarkUrl || undefined}
          alt={brand.orgName}
        />
      </span>
    );
  }
  const subtitle = sub ?? brand.sub;
  const [first, ...rest] = (name ?? brand.shortName).trim().split(/\s+/);
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark className={cn("size-8", invert && "text-white")} />
      <span className="flex flex-col leading-none">
        {/* Como no logotipo: primeiro nome fino, sobrenome pesado */}
        <span className="whitespace-nowrap font-brand text-[16px] uppercase tracking-[0.01em]">
          <span className="font-extralight">{first}</span>
          {rest.length > 0 && <span className="font-extrabold"> {rest.join(" ")}</span>}
        </span>
        {subtitle && (
          <span className="mt-1 text-[8.5px] font-medium uppercase tracking-[0.34em] text-subtle">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
