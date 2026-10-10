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
  `CREATE TABLE IF NOT EXISTS property_documents (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
     name text NOT NULL,
     category text NOT NULL DEFAULT 'outro',
     pathname text NOT NULL,
     url text NOT NULL DEFAULT '',
     size integer NOT NULL DEFAULT 0,
     content_type text NOT NULL DEFAULT 'application/octet-stream',
     uploaded_by text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS property_documents_property_idx ON property_documents (property_id);`,
];
