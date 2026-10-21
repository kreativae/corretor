/** Lembretes da agenda por WhatsApp (Configurações › Lembretes da agenda) */
export type ReminderSettings = {
  enabled: boolean;
  /** Quantas horas antes do horário o lembrete sai */
  hoursBefore: number;
};

export const REMINDER_HOURS = [1, 2, 3, 6, 12, 24, 48] as const;

export const REMINDER_DEFAULTS: ReminderSettings = { enabled: true, hoursBefore: 24 };

export function sanitizeReminders(v: Record<string, unknown>): ReminderSettings {
  const h = Number(v.hoursBefore);
  return {
    enabled: v.enabled !== false,
    hoursBefore: (REMINDER_HOURS as readonly number[]).includes(h) ? h : REMINDER_DEFAULTS.hoursBefore,
  };
}
