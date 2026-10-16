# Deploy no Coolify (servidor Hetzner)

O CRM roda como imagem Docker (`Dockerfile` na raiz) no Coolify, e a Evolution API
(WhatsApp) roda no **mesmo servidor**, sem precisar de VM extra. A Vercel continua
funcionando em paralelo: o `Dockerfile` e o `output: "standalone"` não mudam nada lá.

Banco e arquivos podem continuar no Neon e no Vercel Blob (mesmas variáveis) ou vir
para o servidor: veja as seções 5 (banco) e 6 (arquivos).

---

## 1. Evolution API (WhatsApp)

1. **DNS:** registro `A` de `evolution.SEU-DOMINIO` (ex.: `whatsapp.kreativ.ae`) → IP do servidor.
2. Coolify › projeto › **+ New › Docker Compose Empty** → cole
   [`deploy/evolution/docker-compose.coolify.yml`](../deploy/evolution/docker-compose.coolify.yml).
3. No serviço **evolution**, em **Domains** › **Add Domain**: protocolo `https`,
   domínio `evolution.SEU-DOMINIO` (sem `https://`), porta `8080`. Apague o domínio
   `sslip.io` gerado e ajuste `SERVER_URL` no compose para o mesmo endereço com `https://`.
4. **Deploy**. Teste: `https://evolution.SEU-DOMINIO/` mostra a mensagem de boas-vindas.
5. A **Chave da API** é a variável `SERVICE_PASSWORD_64_EVOLUTION`, na aba
   **Environment Variables** do serviço (gerada pelo Coolify).

A Evolution tem Postgres próprio dentro do compose — não usa o banco do CRM.

## 2. CRM

1. **DNS:** registro `A` do domínio do CRM → IP do servidor.
2. Coolify › projeto › **+ New › Public/Private Repository** → `kreativae/corretor`,
   branch `main`, **Build Pack: Dockerfile**, porta **3000**.
3. **Domains:** o domínio do CRM com `https://`. Empresas com **domínio próprio**
   (coluna `domains` da tabela `tenants`) também entram aqui, separadas por vírgula,
   cada uma com o DNS apontando para o servidor.
4. **Environment Variables** (copie os valores da Vercel: `vercel env pull`):

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | connection string do Neon (a mesma da Vercel) |
| `AUTH_OPEN` | sim | `0` em produção |
| `CRON_SECRET` | sim | segredo do agendador (passo 3) |
| `NEXT_PUBLIC_SITE_URL` | recomendada | `https://dominio-do-crm` — marque **Is Build Variable** |
| `BLOB_READ_WRITE_TOKEN` | sim | token do Vercel Blob (fotos, logos, KMZ) |
| `GERENCIA_KEY` | primeiro acesso | mínimo 12 caracteres |
| `RESEND_API_KEY`, `LEADS_FROM_EMAIL` | opcional | reserva do e-mail; o painel tem prioridade |
| `NEXT_PUBLIC_CARTO_BASEMAP_KEY` | opcional | marque **Is Build Variable** |
| `CARTO_API_TOKEN` | opcional | reserva; o painel tem prioridade |

   Variáveis `NEXT_PUBLIC_*` são gravadas na imagem no build: depois de mudar,
   faça **Redeploy**.
5. **Deploy**.

## 3. Agendador (substitui o cron do `vercel.json`)

Fora da Vercel o `vercel.json` não roda. No app do CRM › **Scheduled Tasks** › **+ Add**:

- **Name:** `google-sync`
- **Command:**
  `wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/google-sync`
- **Frequency:** `0 9 * * *` (todo dia às 9h UTC, igual ao `vercel.json`)

Enquanto a Vercel também estiver no ar, deixe o agendador **desligado** em um dos
dois lados, para a sincronização não rodar em dobro.

## 4. Trocar o domínio de produção

1. Teste tudo num subdomínio provisório.
2. Aponte o DNS do domínio oficial para o servidor e adicione-o em **Domains**.
3. Em **Admin › Configurações › WhatsApp**, troque o **Endereço do servidor** para
   `https://evolution.SEU-DOMINIO` e reconecte pelo QR code.
4. Só depois de algumas semanas estável, desative o projeto na Vercel — **sem**
   remover a integração do Neon nem o Blob Store (podem apagar banco e arquivos).

## 5. Trazer o banco do Neon para o servidor (opcional)

1. Coolify › projeto › **+ New › Database › PostgreSQL**. Imagem `postgres:17-alpine`,
   **Initial Database** `corretor`. Não marque "Make it publicly available".
   Ative **Backups** (agendado, de preferência para um S3).
2. No servidor, rode [`deploy/migrate-neon.sh`](../deploy/migrate-neon.sh) (o cabeçalho
   do arquivo tem o comando). Ele pede a URL **direta** do Neon (sem `-pooler`) e a
   **Postgres URL (internal)** do Coolify, recria os usuários das empresas e copia tudo.
   O Neon só é lido; pode repetir quantas vezes quiser (o destino é apagado a cada vez).
3. No app do CRM, troque `DATABASE_URL` pela URL interna do Coolify e faça **Restart**.

Enquanto a Vercel estiver no ar ela continua gravando no Neon: faça a cópia final
no momento da troca de domínio, com a Vercel já desligada, para não perder dados.

## 6. Trazer os arquivos do Vercel Blob para o servidor (opcional)

Com `UPLOAD_DIR` definido, fotos, logos, KMZ, documentos internos e PDFs da negociação
são gravados no disco em vez do Blob (sem `UPLOAD_DIR`, tudo segue no Blob, como na Vercel).

1. App do CRM › **Persistent Storage** › **+ Add** › **Volume**: destino `/app/storage`.
2. **Environment Variables**: `UPLOAD_DIR=/app/storage`. Mantenha o `BLOB_READ_WRITE_TOKEN`
   até terminar a cópia. **Redeploy**.
3. **Terminal** do app:
   `node scripts/migrate-blob.mjs https://dominio-do-crm`
   Copia todos os arquivos do Blob para o volume e troca, no banco (empresa principal e
   demais empresas), os endereços antigos pelo `/api/media` do domínio informado. Pode
   repetir: pula o que já foi copiado.
4. Confira fotos, logo, KMZ e documentos. Depois remova `BLOB_READ_WRITE_TOKEN`.

Os arquivos ficam no volume do servidor: ative os **Backups** da Hetzner (cópia diária
do servidor inteiro) ou copie `/app/storage` para um S3. No dia da troca de domínio, rode
o script de novo com o domínio definitivo (depois de copiar o banco, seção 5).

## 7. Deploy automático a cada push

App do CRM › **Webhooks** › **Manual Git webhooks › GitHub**: copie a **Webhook URL**
(`.../webhooks/source/github/events/manual`) e gere o **Webhook secret**. No GitHub,
`Settings › Webhooks › Add webhook` com essa URL, `application/json`, o mesmo secret e
"Just the push event". Com **Auto Deploy** ligado (Advanced), cada push na branch do app
dispara o deploy, e o resultado chega pelas notificações do Coolify (Telegram).

Use a URL da seção **GitHub** (`/source/github/`), não a de baixo (GitLab): com a do
GitLab, o GitHub recebe 200 mas o corpo diz "Only push and merge_request events are
allowed" e nada é publicado. Para testar depois de corrigir, faça um push novo: o
"Redeliver" do GitHub reenvia para o endereço antigo.
