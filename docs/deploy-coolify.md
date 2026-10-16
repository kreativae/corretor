# Deploy no Coolify (servidor Hetzner)

O CRM roda como imagem Docker (`Dockerfile` na raiz) no Coolify, e a Evolution API
(WhatsApp) roda no **mesmo servidor**, sem precisar de VM extra. A Vercel continua
funcionando em paralelo: o `Dockerfile` e o `output: "standalone"` não mudam nada lá.

Banco (Neon) e fotos (Vercel Blob) continuam onde estão; o app no Coolify só aponta
para eles com as mesmas variáveis.

---

## 1. Evolution API (WhatsApp)

1. **DNS:** registro `A` de `evolution.SEU-DOMINIO` → IP do servidor.
2. Coolify › projeto › **+ New › Docker Compose Empty** → cole
   [`deploy/evolution/docker-compose.coolify.yml`](../deploy/evolution/docker-compose.coolify.yml).
3. No serviço **evolution**, em **Domains**: `https://evolution.SEU-DOMINIO:8080`
   (o `:8080` diz ao Coolify a porta interna; o acesso público fica em HTTPS normal).
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
