/** Configurações › Segurança (por empresa) */
export type SecuritySettings = {
  /** Entrar com Face ID / Touch ID / Windows Hello (passkey) */
  passkeys: boolean;
};

export const SECURITY_DEFAULTS: SecuritySettings = { passkeys: true };

export function sanitizeSecurity(input: Record<string, unknown>): SecuritySettings {
  return { passkeys: typeof input?.passkeys === "boolean" ? input.passkeys : SECURITY_DEFAULTS.passkeys };
}
