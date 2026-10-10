/**
 * Gera o PDF da ficha no navegador (imagem da folha A4 em alta resolução)
 * e abre o compartilhamento nativo (WhatsApp, e-mail, AirDrop…). Onde o
 * navegador não compartilha arquivos, baixa o PDF.
 */
export async function buildFichaPdf(fileName: string): Promise<File> {
  const sheet = document.querySelector<HTMLElement>(".ficha-sheet");
  if (!sheet) throw new Error("Ficha não encontrada na página.");
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  // Safari (iPhone) só desenha imagens já embutidas e, mesmo assim, costuma
  // omiti-las na primeira captura: embute tudo como data URL e captura duas vezes.
  const restore = await inlineImages(sheet);
  const options = {
    quality: 0.92,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    // Imagem externa sem CORS não derruba a geração
    imagePlaceholder:
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    // A folha fica com zoom na tela do celular; a captura usa o tamanho real
    style: { zoom: "1", margin: "0", boxShadow: "none" },
  };
  let data: string;
  try {
    await toJpeg(sheet, options);
    data = await toJpeg(sheet, options);
  } finally {
    restore();
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.addImage(data, "JPEG", 0, 0, 210, 297, undefined, "FAST");

  // Links clicáveis no PDF (QR code, WhatsApp): mesma posição da tela, em mm
  const box = sheet.getBoundingClientRect();
  const mm = 210 / box.width;
  sheet.querySelectorAll<HTMLElement>("[data-pdf-link]").forEach((el) => {
    const url = el.dataset.pdfLink;
    if (!url) return;
    const r = el.getBoundingClientRect();
    pdf.link((r.left - box.left) * mm, (r.top - box.top) * mm, r.width * mm, r.height * mm, { url });
  });
  return new File([pdf.output("blob")], fileName, { type: "application/pdf" });
}

/** Troca o src de cada <img> por data URL (e devolve uma função que desfaz). */
async function inlineImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  const originals: [HTMLImageElement, string | null, string | null][] = [];
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src, { cache: "force-cache" });
        if (!res.ok) return;
        const dataUrl = await blobToDataUrl(await res.blob());
        originals.push([img, img.getAttribute("src"), img.getAttribute("srcset")]);
        img.removeAttribute("srcset");
        img.removeAttribute("loading");
        img.src = dataUrl;
        await img.decode().catch(() => undefined);
      } catch {
        // Sem acesso à imagem (CORS): fica de fora do PDF
      }
    }),
  );
  return () => {
    for (const [img, src, srcset] of originals) {
      if (srcset) img.setAttribute("srcset", srcset);
      if (src) img.setAttribute("src", src);
    }
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
