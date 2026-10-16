/**
 * Ajustes de schema aplicados automaticamente em cada nova conexão.
 * Idempotentes e sem lock quando já aplicados — dispensa rodar drizzle-kit
 * manualmente no Neon para estas colunas.
 */
export const RUNTIME_MIGRATIONS = [
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'properties' AND column_name = 'rural'
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
       WHERE table_schema = current_schema() AND table_name = 'properties' AND column_name = 'partner_id'
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
  // Vídeo do anúncio (link do YouTube)
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS video_url text;`,
  // WhatsApp (API oficial da Meta): conversas e mensagens
  `CREATE TABLE IF NOT EXISTS wa_threads (
     phone text PRIMARY KEY,
     contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
     profile_name text,
     last_message text,
     last_message_at timestamptz NOT NULL DEFAULT now(),
     last_inbound_at timestamptz,
     unread integer NOT NULL DEFAULT 0,
     archived boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS wa_threads_last_idx ON wa_threads (last_message_at DESC);`,
  `CREATE TABLE IF NOT EXISTS wa_messages (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     phone text NOT NULL,
     contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
     direction text NOT NULL,
     type text NOT NULL DEFAULT 'text',
     body text,
     media_id text,
     media_mime text,
     wa_message_id text UNIQUE,
     status text NOT NULL DEFAULT 'received',
     error text,
     sent_by text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS wa_messages_phone_idx ON wa_messages (phone, created_at);`,
  `CREATE INDEX IF NOT EXISTS wa_messages_contact_idx ON wa_messages (contact_id, created_at);`,
  // WhatsApp: horário de entrega e de leitura
  `ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;`,
  `ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;`,
  // Mapa do m²: amostras de mercado e cache de localização das regiões
  `CREATE TABLE IF NOT EXISTS market_samples (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     type text NOT NULL,
     purpose text NOT NULL DEFAULT 'venda',
     price integer NOT NULL,
     area integer NOT NULL,
     neighborhood text NOT NULL DEFAULT '',
     city text NOT NULL,
     state text NOT NULL DEFAULT '',
     source text,
     notes text,
     sampled_at timestamptz NOT NULL DEFAULT now(),
     created_by text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE TABLE IF NOT EXISTS region_geo (
     key text PRIMARY KEY,
     lat real,
     lng real,
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  // Imposto sobre a comissão: padrão do parceiro e ajuste por imóvel
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'partners' AND column_name = 'tax_pct'
     ) THEN
       ALTER TABLE partners ADD COLUMN tax_pct real, ADD COLUMN tax_base text NOT NULL DEFAULT 'total';
     END IF;
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'properties' AND column_name = 'tax_pct'
     ) THEN
       ALTER TABLE properties ADD COLUMN tax_pct real, ADD COLUMN tax_base text;
     END IF;
   END $$;`,
];

/** Só no banco principal (esquema public): cadastro de empresas da gerência */
export const CONTROL_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS tenants (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     slug text NOT NULL UNIQUE,
     name text NOT NULL,
     schema_name text NOT NULL UNIQUE,
     db_user text,
     db_password text,
     domains jsonb NOT NULL DEFAULT '[]'::jsonb,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  // A empresa que já existia vira a principal (esquema public)
  `INSERT INTO tenants (slug, name, schema_name)
   SELECT 'principal', COALESCE((SELECT value->>'orgName' FROM settings WHERE key = 'whiteLabel'), 'Empresa principal'), 'public'
   ON CONFLICT DO NOTHING;`,
];
