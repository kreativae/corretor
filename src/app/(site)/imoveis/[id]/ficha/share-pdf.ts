/**
 * Gera o PDF da ficha no navegador (imagem da folha A4 em alta resolução)
 * e abre o compartilhamento nativo (WhatsApp, e-mail, AirDrop…). Onde o
 * navegador não compartilha arquivos, baixa o PDF.
 */
export async function buildFichaPdf(fileName: string): Promise<File> {
  const sheet = document.querySelector<HTMLElement>(".ficha-sheet");
  if (!sheet) throw new Error("Ficha não encontrada na página.");
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  const data = await toJpeg(sheet, {
    quality: 0.92,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    // Imagem externa sem CORS não derruba a geração
    imagePlaceholder:
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    // A folha fica com zoom na tela do celular; a captura usa o tamanho real
    style: { zoom: "1", margin: "0", boxShadow: "none" },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.addImage(data, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  return new File([pdf.output("blob")], fileName, { type: "application/pdf" });
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
