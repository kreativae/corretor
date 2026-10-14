# WhatsApp por QR code — servidor da Evolution API

O CRM conversa com o WhatsApp através da [Evolution API](https://doc.evolution-api.com)
(gratuita, código aberto). Ela precisa ficar ligada 24 h, então roda num serviço
separado da Vercel. Abaixo, o jeito mais simples: **Railway** (~US$ 5/mês).

## 1. Banco de dados da Evolution

A Evolution guarda a sessão do WhatsApp num Postgres. Use **um banco separado** do CRM:

- No Railway: **New › Database › PostgreSQL** (mais simples), ou
- No Neon: crie um novo banco `evolution` no mesmo projeto e copie a connection string.

## 2. Subir a Evolution API

No Railway: **New › Docker Image** → `evoapicloud/evolution-api:v2.2.3`

Em **Variables**, cadastre:

| Variável | Valor |
|---|---|
| `AUTHENTICATION_API_KEY` | uma senha longa (gere uma aleatória) — é a "Chave da API" do CRM |
| `SERVER_URL` | o endereço público do serviço (ex.: `https://evolution-production.up.railway.app`) |
| `DATABASE_ENABLED` | `true` |
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_CONNECTION_URI` | a connection string do passo 1 |
| `DATABASE_SAVE_DATA_INSTANCE` | `true` |
| `DATABASE_SAVE_DATA_NEW_MESSAGE` | `true` (necessário para abrir fotos/áudios recebidos) |
| `CACHE_REDIS_ENABLED` | `false` |
| `CACHE_LOCAL_ENABLED` | `true` |
| `CONFIG_SESSION_PHONE_CLIENT` | `CRM Carlos Amâncio` (nome que aparece em "Dispositivos conectados") |
| `CONFIG_SESSION_PHONE_NAME` | `Chrome` |
| `DEL_INSTANCE` | `false` |

Em **Settings › Networking**, gere um domínio público (porta **8080**).

Teste: abrir `https://SEU-DOMINIO/` deve mostrar uma mensagem de boas-vindas da Evolution.

## 3. Conectar no CRM

1. **Admin › Configurações › WhatsApp** → aba **QR code (Evolution API)**
2. Preencha **Endereço do servidor** (o domínio do passo 2) e **Chave da API**
   (o `AUTHENTICATION_API_KEY`). A instância pode ficar `corretor`.
3. **Conectar com QR code** → no celular: WhatsApp › Dispositivos conectados ›
   Conectar um dispositivo → leia o QR.
4. Pronto: aparece **Conectado** com o número. O webhook é configurado sozinho.

As conversas chegam em **CRM › WhatsApp**; número que não está no CRM vira lead
(se "Criar lead automaticamente" estiver ligado).

## Boas práticas (evitar bloqueio do número)

- Use para **atendimento** (responder e conversar). Evite disparo em massa para
  quem não tem o número da imobiliária salvo.
- Mantenha o celular com internet de vez em quando — se o WhatsApp desconectar o
  aparelho, o CRM mostra um aviso para ler o QR de novo.
- Para atualizar a Evolution, troque a tag da imagem (ex.: `v2.2.3` → versão nova)
  depois de conferir as notas de versão.
