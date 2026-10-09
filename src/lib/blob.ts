import "server-only";

/** Token do Blob — aceita prefixo customizado (ex.: CORRETOR_BLOB_READ_WRITE_TOKEN). */
export function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN"));
  return key ? process.env[key] : undefined;
}

/** Fotos de imóveis ficam sob este prefixo; só ele é servido por /api/media. */
export const MEDIA_PREFIX = "imoveis/";
