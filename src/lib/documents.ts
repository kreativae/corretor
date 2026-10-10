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

/** Limite de corpo das funções da Vercel (4,5 MB) com folga */
export const DOC_MAX_BYTES = 4 * 1024 * 1024;

export function docExtension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
