import "server-only";

/** Token do Blob — aceita prefixo customizado (ex.: CORRETOR_BLOB_READ_WRITE_TOKEN). */
export function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN"));
  return key ? process.env[key] : undefined;
}

/** Pastas permitidas no Blob; só elas são servidas por /api/media. */
export const MEDIA_FOLDERS = ["imoveis", "marca", "kmz"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export function isMediaPath(pathname: string) {
  return MEDIA_FOLDERS.some((f) => pathname.startsWith(`${f}/`)) && !pathname.includes("..");
}
