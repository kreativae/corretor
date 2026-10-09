import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash scrypt com salt único por usuário — formato "salt:hash". */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  try {
    const candidate = scryptSync(password, salt, 64);
    const original = Buffer.from(hash, "hex");
    return (
      candidate.length === original.length &&
      timingSafeEqual(candidate, original)
    );
  } catch {
    return false;
  }
}
