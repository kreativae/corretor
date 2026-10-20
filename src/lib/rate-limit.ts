import "server-only";

/**
 * Limite de tentativas em memória (um contêiner só no servidor). Janela deslizante simples:
 * guarda os horários das últimas tentativas de cada chave.
 */
const buckets = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, hits] of buckets) {
    if (!hits.length || now - hits[hits.length - 1] > 24 * 3600_000) buckets.delete(k);
  }
}

/** Quantas tentativas a chave fez dentro da janela */
export function countHits(key: string, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, hits);
  return hits.length;
}

/** Registra uma tentativa */
export function addHit(key: string) {
  const now = Date.now();
  sweep(now);
  const hits = buckets.get(key) ?? [];
  hits.push(now);
  if (hits.length > 2000) hits.splice(0, hits.length - 2000);
  buckets.set(key, hits);
}

/** Registra e diz se passou do limite */
export function overLimit(key: string, limit: number, windowMs: number) {
  addHit(key);
  return countHits(key, windowMs) > limit;
}

/** Segundos até a tentativa mais antiga sair da janela */
export function retryAfter(key: string, windowMs: number) {
  const hits = buckets.get(key) ?? [];
  if (!hits.length) return 0;
  return Math.max(1, Math.ceil((hits[0] + windowMs - Date.now()) / 1000));
}

export function clearHits(key: string) {
  buckets.delete(key);
}

/** IP de quem chamou (Traefik/Vercel repassam no x-forwarded-for) */
export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "desconhecido";
}
