# WhatsApp por QR code — servidor da Evolution API

O CRM conversa com o WhatsApp através da [Evolution API](https://doc.evolution-api.com)
(gratuita, código aberto). Ela precisa ficar ligada 24 h, então roda num serviço
separado da Vercel. Duas opções:

- **Grátis: Oracle Cloud (Always Free)** — uma máquina virtual gratuita para sempre. Abaixo.
- **Pago e mais simples: Railway** (~US$ 5/mês) — mais adiante.

Planos grátis que "dormem" sem uso (Render, Koyeb, Hugging Face) **não servem**:
a sessão do WhatsApp cai quando o servidor dorme.

---

## Opção grátis — Oracle Cloud (Always Free)

### 1. Banco de dados (Neon, grátis)
No Neon (onde o CRM já está), crie um **banco novo** chamado `evolution` e copie
a connection string (`postgresql://…?sslmode=require`). Não use o banco do CRM.

### 2. Criar a máquina
1. Crie a conta em **cloud.oracle.com** (pede cartão só para verificação; o
   plano Always Free não cobra).
2. **Compute › Instances › Create instance**
   - Imagem: **Ubuntu 22.04** (ou 24.04)
   - Shape: **Ampere (VM.Standard.A1.Flex)** com 1 OCPU e 6 GB — dentro do grátis.
     Se não houver capacidade na região, use **VM.Standard.E2.1.Micro** (também grátis).
   - Baixe a chave SSH que a Oracle oferece.
3. Na rede da instância (**Subnet › Security List › Add Ingress Rules**), libere
   as portas **80** e **443** (origem `0.0.0.0/0`, TCP).
4. Anote o **IP público** da máquina.

### 3. Instalar (copiar e colar)
Conecte por SSH (`ssh -i chave.key ubuntu@IP`) e rode:

```bash
git clone https://github.com/kreativae/corretor.git
cd corretor/deploy/evolution
bash setup.sh          # instala o Docker e cria o arquivo .env
nano .env              # preencha DOMAIN, AUTHENTICATION_API_KEY e DATABASE_CONNECTION_URI
bash setup.sh          # sobe a Evolution com HTTPS
```

Sem domínio próprio, use o IP com **sslip.io**: IP `129.146.10.20` →
`DOMAIN=129-146-10-20.sslip.io`. O HTTPS é gerado sozinho (Caddy + Let's Encrypt).

> O repositório é privado? Em vez do `git clone`, copie a pasta `deploy/evolution`
> para a máquina (`scp -i chave.key -r deploy/evolution ubuntu@IP:~`).

Teste: `https://SEU-DOMINIO/` mostra a mensagem de boas-vindas da Evolution.
Depois, siga o passo **Conectar no CRM** abaixo (endereço = `https://SEU-DOMINIO`).

**Alternativa grátis:** Google Cloud **e2-micro** (Always Free, regiões dos EUA) —
mesmo processo, com o `setup.sh` (ele cria memória extra/swap para a máquina pequena).

---

## Opção paga — Railway (~US$ 5/mês)

### 1. Banco de dados da Evolution

A Evolution guarda a sessão do WhatsApp num Postgres. Use **um banco separado** do CRM:

- No Railway: **New › Database › PostgreSQL** (mais simples), ou
- No Neon: crie um novo banco `evolution` no mesmo projeto e copie a connection string.

### 2. Subir a Evolution API

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

---

## Conectar no CRM

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
