/** Envio de imagens do navegador para /api/uploads (Vercel Blob). */

const MAX_SIDE = 2560;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Envia para /api/uploads com progresso real (fetch não expõe upload progress). */
export function sendFile(
  file: File,
  onProgress: (pct: number) => void,
  folder: "imoveis" | "marca" | "kmz" = "imoveis",
) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* resposta não-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
      else reject(new Error(data.error || `Falha no envio (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Falha de rede no envio."));
    xhr.ontimeout = () => reject(new Error("O envio demorou demais. Tente novamente."));
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    xhr.send(body);
  });
}

/**
 * Reduz a foto no navegador antes do envio (lado maior ≤ 2560 px, WebP 85%).
 * Fotos de câmera caem de ~10 MB para < 1 MB. Mantém o original se não ganhar.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let blob: Blob | null = null;
    // Tenta qualidade/tamanho menores até caber no limite de envio
    for (const [side, quality] of [[MAX_SIDE, 0.85], [1920, 0.8], [1600, 0.72]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (!blob || blob.size <= MAX_UPLOAD_BYTES) break;
    }
    bitmap.close();
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
