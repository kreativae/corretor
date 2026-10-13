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
  // Parceiros (imóveis captados por outros corretores/imobiliárias)
  `CREATE TABLE IF NOT EXISTS partners (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text NOT NULL,
     company text,
     phone text,
     email text,
     creci text,
     commission_pct real,
     partner_share_pct real,
     watermark text NOT NULL DEFAULT 'padrao',
     notes text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'properties' AND column_name = 'partner_id'
     ) THEN
       ALTER TABLE properties
         ADD COLUMN partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
         ADD COLUMN commission_pct real,
         ADD COLUMN partner_share_pct real;
     END IF;
   END $$;`,
  `CREATE INDEX IF NOT EXISTS properties_partner_idx ON properties (partner_id);`,
  // Negociação: e-mails com seleção de imóveis enviados ao cliente (histórico)
  `CREATE TABLE IF NOT EXISTS property_sends (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
     to_name text,
     to_email text NOT NULL,
     subject text NOT NULL,
     message text,
     properties jsonb NOT NULL DEFAULT '[]'::jsonb,
     attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
     status text NOT NULL DEFAULT 'enviado',
     error text,
     provider_id text,
     sent_by text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS property_sends_contact_idx ON property_sends (contact_id, created_at DESC);`,
];
