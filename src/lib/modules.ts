/** Módulos que a gerência libera ou bloqueia por cliente (plano). */
export const MODULES = [
  { key: "whatsapp", label: "WhatsApp", description: "Caixa de entrada, conexão por QR code e mensagens no contato.", paths: ["/crm/whatsapp"] },
  { key: "negociacao", label: "Negociação", description: "Envio de fichas por e-mail ao cliente, com histórico.", paths: ["/crm/negociacao"] },
  { key: "valorM2", label: "Valor do m²", description: "Mapa e ranking do valor por bairro e município.", paths: ["/crm/valor-m2"] },
  { key: "rurais", label: "Propriedades rurais", description: "Cadastro de fazendas, sítios e chácaras, KMZ e mapa de satélite.", paths: ["/crm/propriedades"] },
  { key: "parceiros", label: "Parceiros", description: "Imóveis de parceiros e divisão de comissão.", paths: ["/crm/parceiros"] },
  { key: "calculadora", label: "Calculadoras", description: "Comissão, conversão de áreas e porcentagens.", paths: ["/crm/calculadora"] },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Modules = Record<ModuleKey, boolean>;

export const MODULES_ALL_ON = Object.fromEntries(MODULES.map((m) => [m.key, true])) as Modules;

/** Módulo dono de um caminho do CRM (ou null) */
export function moduleOfPath(path: string): ModuleKey | null {
  for (const m of MODULES) if (m.paths.some((p) => path === p || path.startsWith(`${p}/`))) return m.key;
  return null;
}

/** Situação da conta, plano e limites — definidos pela gerência */
export type Account = {
  status: "ativo" | "suspenso";
  suspendedMessage: string;
  /** Suspensão também tira o site público do ar */
  suspendSite: boolean;
  plan: string;
  /** 0 = sem limite */
  maxUsers: number;
  maxProperties: number;
  modules: Modules;
  notes: string;
};

export const ACCOUNT_DEFAULTS: Account = {
  status: "ativo",
  suspendedMessage: "",
  suspendSite: false,
  plan: "",
  maxUsers: 0,
  maxProperties: 0,
  modules: MODULES_ALL_ON,
  notes: "",
};

export function sanitizeAccount(input: Record<string, unknown>): Account {
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const int = (v: unknown) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : 0;
  };
  const mods = (input.modules ?? {}) as Record<string, unknown>;
  return {
    status: input.status === "suspenso" ? "suspenso" : "ativo",
    suspendedMessage: str(input.suspendedMessage, 500),
    suspendSite: input.suspendSite === true,
    plan: str(input.plan, 60),
    maxUsers: int(input.maxUsers),
    maxProperties: int(input.maxProperties),
    modules: Object.fromEntries(MODULES.map((m) => [m.key, mods[m.key] !== false])) as Modules,
    notes: str(input.notes, 2000),
  };
}
