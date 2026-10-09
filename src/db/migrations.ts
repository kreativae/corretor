/**
 * Ajustes de schema aplicados automaticamente em cada nova conexão.
 * Idempotentes e sem lock quando já aplicados — dispensa rodar drizzle-kit
 * manualmente no Neon para estas colunas.
 */
export const RUNTIME_MIGRATIONS = [
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'properties' AND column_name = 'rural'
     ) THEN
       ALTER TABLE properties ADD COLUMN rural jsonb;
     END IF;
   END $$;`,
];
