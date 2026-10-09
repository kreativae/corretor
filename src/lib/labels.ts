/* Mapas de labels, cores e constantes de domínio (pt-BR) */

export const TYPE_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  cobertura: "Cobertura",
  estudio: "Estúdio",
  terreno: "Terreno",
};

export const PURPOSE_LABELS: Record<string, string> = {
  venda: "Venda",
  aluguel: "Aluguel",
};

export const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

/* classes de badge por status (leve, dessaturado) */
export const STATUS_STYLES: Record<string, string> = {
  disponivel:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  reservado:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  vendido: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
  alugado: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  inativo: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const VISIT_STATUS_STYLES: Record<string, string> = {
  agendada: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  confirmada:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  realizada:
    "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20",
  cancelada: "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20",
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  cliente: "Cliente",
  proprietario: "Proprietário",
};

export const SOURCE_LABELS: Record<string, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  portal: "Portal",
  indicacao: "Indicação",
  visita: "Visita",
  google: "Google Contacts",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  corretor: "Corretor",
};

export const DEAL_STAGES = [
  { id: "novo", label: "Novo interesse", dot: "#8b8b86" },
  { id: "contato", label: "Contato feito", dot: "#60a5fa" },
  { id: "visita", label: "Visita agendada", dot: "#c084fc" },
  { id: "proposta", label: "Proposta", dot: "#f59e0b" },
  { id: "documentacao", label: "Documentação", dot: "#fb923c" },
  { id: "fechado", label: "Fechado", dot: "#10b981" },
] as const;

export const DEAL_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.id, s.label]),
);

export const PORTAL_STATUS_LABELS: Record<string, string> = {
  conectado: "Conectado",
  desconectado: "Desconectado",
  sincronizando: "Sincronizando",
  erro: "Erro",
};

export const FEATURES = [
  "Piscina",
  "Churrasqueira",
  "Academia",
  "Varanda gourmet",
  "Home office",
  "Closet",
  "Ar-condicionado",
  "Aquecimento a gás",
  "Portaria 24h",
  "Pet friendly",
  "Energia solar",
  "Automação",
  "Elevador",
  "Playground",
  "Salão de festas",
  "Jardim",
  "Lareira",
  "Vista livre",
  "Mobiliado",
  "Cozinha integrada",
];

export const ACTIVITY_ICONS: Record<string, string> = {
  created: "plus",
  updated: "pencil",
  visit: "calendar",
  sync: "refresh",
  pdf: "file",
  stage: "move",
  message: "message",
  match: "sparkles",
  lead: "user",
};
