/**
 * Agendador interno: no servidor próprio (Coolify) chama /api/cron/tick a cada 10 minutos,
 * para os lembretes da agenda saírem na hora e o Google sincronizar no intervalo de cada
 * integração. Na Vercel (sem processo contínuo) não roda: lá vale o cron do vercel.json.
 * TICK_INTERVAL_MIN muda o intervalo; TICK_DISABLED=1 desliga.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL || process.env.TICK_DISABLED === "1") return;
  if (process.env.NODE_ENV !== "production" && process.env.TICK_DEV !== "1") return;

  const { randomBytes } = await import("node:crypto");
  // Token só deste processo: ninguém de fora consegue disparar a batida sem o CRON_SECRET
  process.env.TICK_TOKEN ||= randomBytes(24).toString("hex");
  const minutes = Math.max(1, Number(process.env.TICK_INTERVAL_MIN) || 10);
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/tick`;

  const tick = async () => {
    try {
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.TICK_TOKEN}` } });
      if (!res.ok) console.error("[agendador]", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("[agendador]", e instanceof Error ? e.message : e);
    }
  };
  // Primeira batida 1 min depois de subir (o servidor já está pronto)
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), minutes * 60_000);
  }, 60_000);
}
