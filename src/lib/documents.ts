/** Documentos internos de imóveis — compartilhado entre servidor e navegador. */

export const DOC_CATEGORIES = {
  escritura: "Escritura",
  matricula: "Matrícula",
  contrato: "Contrato",
  procuracao: "Procuração",
  iptu_itr: "IPTU / ITR",
  car_ccir: "CAR / CCIR",
  certidao: "Certidão",
  planta: "Planta / projeto",
  laudo: "Laudo / avaliação",
  outro: "Outro",
} as const;
export type DocCategory = keyof typeof DOC_CATEGORIES;

/** Extensões aceitas (o navegador nem sempre informa o tipo) */
export const DOC_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain",
  csv: "text/csv",
  kmz: "application/vnd.google-earth.kmz",
  kml: "application/vnd.google-earth.kml+xml",
  zip: "application/zip",
  dwg: "application/acad",
};

/** Até aqui o arquivo passa pelo servidor (limite de 4,5 MB das funções da Vercel) */
export const DOC_MAX_BYTES = 4 * 1024 * 1024;
/** Acima de DOC_MAX_BYTES, vai direto do navegador para o Blob, até este limite */
export const DOC_DIRECT_MAX_BYTES = 100 * 1024 * 1024;

/** Nome seguro para o caminho no Blob (sem acentos/espaços) */
export function safeDocName(name: string) {
  const ext = docExtension(name);
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-80) || `documento.${ext}`
  );
}

export function docExtension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
