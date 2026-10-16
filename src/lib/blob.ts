import "server-only";
import { del, get, head, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Armazenamento de arquivos: disco do servidor quando UPLOAD_DIR está definido
 * (Coolify, com volume persistente) ou Vercel Blob (token) no resto.
 * Os caminhos são os mesmos nos dois ("imoveis/foto-xxxx.jpg"), então os
 * arquivos copiados do Blob para o disco seguem válidos.
 */

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

const uploadDir = () => process.env.UPLOAD_DIR?.trim() || "";

/** Arquivos no disco do servidor (UPLOAD_DIR) em vez do Vercel Blob */
export function isLocalStorage() {
  return !!uploadDir();
}

/** Há onde gravar? */
export function storageReady() {
  return isLocalStorage() || !!blobToken();
}

export const STORAGE_MISSING =
  "Armazenamento não configurado: defina UPLOAD_DIR (servidor) ou conecte o Vercel Blob.";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  pdf: "application/pdf",
  kmz: "application/vnd.google-earth.kmz",
  kml: "application/vnd.google-earth.kml+xml",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

const typeOf = (pathname: string) =>
  TYPES[pathname.toLowerCase().split(".").pop() ?? ""] ?? "application/octet-stream";

/** Caminho no disco, sem escapar de UPLOAD_DIR */
function diskPath(pathname: string) {
  const root = path.resolve(uploadDir());
  const full = path.resolve(root, pathname);
  if (!full.startsWith(root + path.sep)) throw new Error("Caminho inválido.");
  return full;
}

/** "imoveis/foto.jpg" → "imoveis/foto-<aleatório>.jpg", como o addRandomSuffix do Blob */
function withSuffix(pathname: string) {
  const dot = pathname.lastIndexOf(".");
  const suffix = randomBytes(16).toString("base64url").replace(/[-_]/g, "").slice(0, 21);
  return dot > pathname.lastIndexOf("/")
    ? `${pathname.slice(0, dot)}-${suffix}${pathname.slice(dot)}`
    : `${pathname}-${suffix}`;
}

/** Caminho do arquivo a partir do endereço público do Blob (ou o próprio caminho) */
export function pathnameOf(urlOrPathname: string) {
  if (!/^https?:\/\//.test(urlOrPathname)) return urlOrPathname;
  return decodeURIComponent(new URL(urlOrPathname).pathname.replace(/^\/(api\/media\/)?/, ""));
}

export type Stored = { pathname: string; url: string; access: "public" | "private" };

/**
 * Grava com sufixo aleatório. No Blob tenta o acesso preferido e cai para o
 * outro se o store não aceitar; no disco é sempre privado (url vazia).
 */
export async function putFile(
  pathname: string,
  body: File | Blob | Buffer,
  opts: { contentType: string; prefer: "public" | "private" },
): Promise<Stored> {
  if (isLocalStorage()) {
    const finalPath = withSuffix(pathname);
    const full = diskPath(finalPath);
    await mkdir(path.dirname(full), { recursive: true });
    const data = Buffer.isBuffer(body) ? body : Buffer.from(await body.arrayBuffer());
    await writeFile(full, data);
    return { pathname: finalPath, url: "", access: "private" };
  }
  const token = blobToken();
  if (!token) throw new Error(STORAGE_MISSING);
  const options = { token, addRandomSuffix: true, contentType: opts.contentType } as const;
  const other = opts.prefer === "public" ? "private" : "public";
  try {
    const blob = await put(pathname, body, { ...options, access: opts.prefer });
    return { pathname: blob.pathname, url: opts.prefer === "public" ? blob.url : "", access: opts.prefer };
  } catch (e) {
    if (!(e instanceof Error && /public|private/i.test(e.message))) throw e;
    const blob = await put(pathname, body, { ...options, access: other });
    return { pathname: blob.pathname, url: other === "public" ? blob.url : "", access: other };
  }
}

export type FileRead = { stream: ReadableStream<Uint8Array>; contentType: string; size: number };

/** Lê o arquivo (null se não existe). `access` só vale para o Blob. */
export async function getFile(
  pathname: string,
  access: "public" | "private" = "private",
): Promise<FileRead | null> {
  if (isLocalStorage()) {
    try {
      const full = diskPath(pathname);
      const info = await stat(full);
      if (!info.isFile()) return null;
      const stream = Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>;
      return { stream, contentType: typeOf(pathname), size: info.size };
    } catch {
      return null;
    }
  }
  const token = blobToken();
  if (!token) return null;
  const r = await get(pathname, { access, token }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return { stream: r.stream, contentType: r.blob.contentType, size: r.blob.size };
}

/** Tamanho e tipo de um arquivo já gravado (null se não existe) */
export async function headFile(urlOrPathname: string) {
  if (isLocalStorage()) {
    const pathname = pathnameOf(urlOrPathname);
    const info = await stat(diskPath(pathname)).catch(() => null);
    return info?.isFile() ? { pathname, url: "", size: info.size, contentType: typeOf(pathname) } : null;
  }
  const token = blobToken();
  if (!token) return null;
  const info = await head(urlOrPathname, { token }).catch(() => null);
  return info ? { pathname: info.pathname, url: info.url, size: info.size, contentType: info.contentType } : null;
}

/** Apaga arquivos (endereços do Blob ou caminhos). Falhas só vão para o log. */
export async function deleteFiles(list: string[]) {
  if (!list.length) return;
  if (isLocalStorage()) {
    await Promise.all(
      list.map((item) =>
        Promise.resolve()
          .then(() => unlink(diskPath(pathnameOf(item))))
          .catch((e) => e?.code !== "ENOENT" && console.error("[arquivos]", e)),
      ),
    );
    return;
  }
  const token = blobToken();
  if (token) await del(list, { token }).catch((e) => console.error(e));
}
