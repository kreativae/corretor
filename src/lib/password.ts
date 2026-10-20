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

/** Regras de senha nova (também usadas pelo administrador) */
export function passwordProblem(pass: string, email?: string | null) {
  if (pass.length < 8) return "A senha deve ter ao menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(pass) || !/\d/.test(pass)) return "Use letras e números na senha.";
  if (email && pass.toLowerCase().includes(email.split("@")[0].toLowerCase())) return "A senha não pode conter o seu e-mail.";
  if (/^(.)\1+$/.test(pass) || ["12345678", "password", "senha123", "abc12345"].includes(pass.toLowerCase())) {
    return "Senha fácil demais. Escolha outra.";
  }
  return null;
}
