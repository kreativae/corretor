"use client";

import { Button } from "@/components/ui";
import { Loader2, Mic, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Formato que o navegador grava (Chrome: webm, Firefox: ogg, Safari/iPhone: mp4) */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

const MAX_SECONDS = 5 * 60;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Botão de microfone do WhatsApp: toca para gravar; durante a gravação aparecem o tempo,
 * cancelar e enviar. Chega no celular do cliente como mensagem de voz.
 */
export function VoiceRecorder({
  disabled,
  onRecording,
  onSend,
}: {
  disabled?: boolean;
  /** Avisa o pai para esconder a caixa de texto durante a gravação */
  onRecording: (on: boolean) => void;
  onSend: (file: File) => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "rec" | "sending">("idle");
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const timer = useRef<number | null>(null);

  const stopTracks = () => rec.current?.stream.getTracks().forEach((t) => t.stop());
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    stopTracks();
  }, []);

  async function start() {
    const mime = pickMime();
    if (!navigator.mediaDevices?.getUserMedia || !mime) {
      toast.error("Este navegador não grava áudio.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      toast.error(
        name === "NotFoundError"
          ? "Nenhum microfone encontrado neste aparelho."
          : name === "NotReadableError"
            ? "O microfone está em uso por outro programa."
            : "O navegador bloqueou o microfone. Libere no cadeado ao lado do endereço do site.",
      );
      return;
    }
    const r = new MediaRecorder(stream, { mimeType: mime });
    chunks.current = [];
    cancelled.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = async () => {
      stopTracks();
      if (timer.current) window.clearInterval(timer.current);
      if (cancelled.current || !chunks.current.length) {
        setState("idle");
        onRecording(false);
        return;
      }
      const type = mime.split(";")[0];
      const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
      const file = new File(chunks.current, `audio.${ext}`, { type });
      setState("sending");
      try {
        await onSend(file);
      } finally {
        setState("idle");
        onRecording(false);
      }
    };
    rec.current = r;
    r.start(250);
    setSecs(0);
    setState("rec");
    onRecording(true);
    timer.current = window.setInterval(() => {
      setSecs((s) => {
        if (s + 1 >= MAX_SECONDS) r.state === "recording" && r.stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop(cancel: boolean) {
    cancelled.current = cancel;
    if (rec.current?.state === "recording") rec.current.stop();
  }

  if (state === "idle") {
    return (
      <Button variant="accent" onClick={start} disabled={disabled} className="h-11" aria-label="Gravar áudio" title="Gravar áudio">
        <Mic className="size-4" />
      </Button>
    );
  }
  return (
    <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-hairline bg-soft px-2">
      <button
        type="button"
        onClick={() => stop(true)}
        disabled={state === "sending"}
        className="grid size-8 place-items-center rounded-full text-subtle hover:bg-card hover:text-red-600"
        aria-label="Cancelar gravação"
      >
        <X className="size-4" />
      </button>
      <span className="flex flex-1 items-center gap-2 text-sm">
        {state === "rec" ? (
          <>
            <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
            Gravando <span className="font-mono tabular text-subtle">{mmss(secs)}</span>
          </>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" /> Enviando áudio…
          </>
        )}
      </span>
      <Button variant="accent" size="sm" onClick={() => stop(false)} disabled={state === "sending"} className="h-8" aria-label="Enviar áudio">
        <Send className="size-3.5" />
      </Button>
    </div>
  );
}
