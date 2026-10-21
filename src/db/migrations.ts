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
  // WhatsApp por usuário: cada conversa pertence a uma linha ("main" = número da empresa)
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'wa_threads' AND column_name = 'line'
     ) THEN
       ALTER TABLE wa_threads ADD COLUMN line text NOT NULL DEFAULT 'main';
       ALTER TABLE wa_threads DROP CONSTRAINT IF EXISTS wa_threads_pkey;
       ALTER TABLE wa_threads ADD PRIMARY KEY (line, phone);
     END IF;
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'wa_messages' AND column_name = 'line'
     ) THEN
       ALTER TABLE wa_messages ADD COLUMN line text NOT NULL DEFAULT 'main';
       ALTER TABLE wa_messages DROP CONSTRAINT IF EXISTS wa_messages_wa_message_id_key;
       ALTER TABLE wa_messages DROP CONSTRAINT IF EXISTS wa_messages_wa_message_id_unique;
       CREATE UNIQUE INDEX IF NOT EXISTS wa_messages_line_wa_id_key ON wa_messages (line, wa_message_id);
       CREATE INDEX IF NOT EXISTS wa_messages_line_phone_idx ON wa_messages (line, phone, created_at);
     END IF;
   END $$;`,
  // E-mail por usuário (Resend): endereço de cada um e mensagens recebidas/enviadas
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'mailbox'
     ) THEN
       ALTER TABLE users ADD COLUMN mailbox text;
       CREATE UNIQUE INDEX IF NOT EXISTS users_mailbox_key ON users (mailbox) WHERE mailbox IS NOT NULL;
     END IF;
   END $$;`,
  `CREATE TABLE IF NOT EXISTS mail_messages (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES users(id) ON DELETE CASCADE,
     direction text NOT NULL,
     from_addr text NOT NULL,
     from_name text,
     to_addrs jsonb NOT NULL DEFAULT '[]'::jsonb,
     cc_addrs jsonb NOT NULL DEFAULT '[]'::jsonb,
     subject text NOT NULL DEFAULT '',
     text text,
     html text,
     attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
     message_id text,
     in_reply_to text,
     provider_id text,
     contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
     read boolean NOT NULL DEFAULT false,
     sent_by text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS mail_messages_user_idx ON mail_messages (user_id, direction, created_at DESC);`,
  // O mesmo e-mail recebido entra uma vez por caixa (o Resend pode reenviar o webhook)
  `CREATE UNIQUE INDEX IF NOT EXISTS mail_messages_provider_owner_key
     ON mail_messages (provider_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), direction)
     WHERE provider_id IS NOT NULL;`,
  // Conversas: as mensagens que já existiam viram conversas de uma mensagem só
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'mail_messages' AND column_name = 'thread_id'
     ) THEN
       ALTER TABLE mail_messages ADD COLUMN thread_id uuid;
       UPDATE mail_messages SET thread_id = id WHERE thread_id IS NULL;
       ALTER TABLE mail_messages ALTER COLUMN thread_id SET NOT NULL;
       CREATE INDEX IF NOT EXISTS mail_messages_thread_idx ON mail_messages (thread_id, created_at);
     END IF;
   END $$;`,
  // Cargo do usuário e corretor responsável pelo imóvel (assinam a ficha)
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'title'
     ) THEN
       ALTER TABLE users ADD COLUMN title text;
     END IF;
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'properties' AND column_name = 'responsible_id'
     ) THEN
       ALTER TABLE properties ADD COLUMN responsible_id uuid REFERENCES users(id) ON DELETE SET NULL;
     END IF;
   END $$;`,
  `CREATE TABLE IF NOT EXISTS mail_uploads (
     pathname text PRIMARY KEY,
     access text NOT NULL DEFAULT 'private',
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  // Observações do anúncio (informações complementares no site e na ficha)
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS notes text;`,
  // Senha do KMZ (mapa e download no site), fora da tabela de imóveis
  `CREATE TABLE IF NOT EXISTS property_kmz_locks (
     property_id uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
     password text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  // Verificação em duas etapas e aparelhos conectados
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step integer;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes text NOT NULL DEFAULT '';
   ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;
   ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip text;`,
  // Biometria (Face ID, Touch ID, Windows Hello): chaves de acesso (passkeys) por aparelho
  `CREATE TABLE IF NOT EXISTS passkeys (
     id text PRIMARY KEY,
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     public_key text NOT NULL,
     counter bigint NOT NULL DEFAULT 0,
     transports jsonb NOT NULL DEFAULT '[]'::jsonb,
     name text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     last_used_at timestamptz
   );`,
  // Terrenos: medidas, zoneamento, infraestrutura e vantagens
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS land jsonb;`,
  // Negociação: envio também pelo WhatsApp (canal e número; e-mail passa a ser opcional)
  `ALTER TABLE property_sends ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';`,
  `ALTER TABLE property_sends ADD COLUMN IF NOT EXISTS to_phone text;`,
  `ALTER TABLE property_sends ALTER COLUMN to_email DROP NOT NULL;`,
  // Site: imóvel em destaque e selo (badge) no card
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS badge text;`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS badge_label text;`,
  // Agenda: eventos e reuniões (cliente opcional)
  `CREATE TABLE IF NOT EXISTS agenda_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     kind text NOT NULL DEFAULT 'reuniao',
     title text NOT NULL,
     starts_at timestamptz NOT NULL,
     ends_at timestamptz,
     location text,
     notes text,
     contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
     status text NOT NULL DEFAULT 'agendado',
     created_by text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS agenda_events_starts_idx ON agenda_events (starts_at);`,
  // Lembrete por WhatsApp (uma vez por horário) e Google Calendar nos eventos
  `ALTER TABLE visits ADD COLUMN IF NOT EXISTS reminded_at timestamptz;`,
  `ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS reminded_at timestamptz;`,
  `ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS google_event_id text;`,
  `ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS google_etag text;`,
  `ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;`,
  // Link do Google Meet gerado para a reunião
  `ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS meet_url text;`,
  // Ponto de foco das fotos (onde o corte se centra), por foto
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS image_focus jsonb;`,
  // WhatsApp: junta as conversas do mesmo celular com e sem o 9 (fica a forma em que o cliente escreveu)
  `DO $$
   DECLARE r record; keep text; gone text;
   BEGIN
     FOR r IN
       SELECT a.line, a.phone AS p12, b.phone AS p13, a.last_inbound_at AS in12, b.last_inbound_at AS in13
       FROM wa_threads a
       JOIN wa_threads b ON b.line = a.line AND b.phone = left(a.phone, 4) || '9' || substr(a.phone, 5)
       WHERE length(a.phone) = 12 AND a.phone LIKE '55%'
     LOOP
       IF r.in13 IS NOT NULL AND r.in12 IS NULL THEN keep := r.p13; gone := r.p12; ELSE keep := r.p12; gone := r.p13; END IF;
       UPDATE wa_messages SET phone = keep WHERE line = r.line AND phone = gone;
       UPDATE wa_threads k SET
         contact_id = COALESCE(k.contact_id, d.contact_id),
         profile_name = COALESCE(k.profile_name, d.profile_name),
         last_message = CASE WHEN d.last_message_at > k.last_message_at THEN d.last_message ELSE k.last_message END,
         last_message_at = GREATEST(k.last_message_at, d.last_message_at),
         last_inbound_at = GREATEST(k.last_inbound_at, d.last_inbound_at),
         unread = k.unread + d.unread,
         archived = k.archived AND d.archived,
         created_at = LEAST(k.created_at, d.created_at)
       FROM wa_threads d
       WHERE k.line = r.line AND k.phone = keep AND d.line = r.line AND d.phone = gone;
       DELETE FROM wa_threads WHERE line = r.line AND phone = gone;
     END LOOP;
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
