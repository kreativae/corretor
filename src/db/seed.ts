import "dotenv/config";
import { hashPassword } from "../lib/password";
import { db } from "./index";
import { randomUUID } from "node:crypto";
import {
  activities,
  apiKeys,
  integrations,
  propertyViews,
  sessions,
  contacts,
  deals,
  portals,
  properties,
  propertyImages,
  settings,
  users,
  visits,
} from "./schema";

const E = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200`;

async function main() {
  console.log("limpando tabelas…");
  await db.delete(activities);
  await db.delete(visits);
  await db.delete(deals);
  await db.delete(propertyImages);
  await db.delete(properties);
  await db.delete(contacts);
  await db.delete(propertyViews);
  await db.delete(portals);
  await db.delete(apiKeys);
  await db.delete(integrations);
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(settings);

  console.log("seed: configurações…");
  await db.insert(settings).values({
    key: "whiteLabel",
    value: {
      orgName: "NORD Imóveis",
      domain: "nordimoveis.com.br",
      accent: "#10b981",
      phone: "5511998765432",
      tagline: "Imobiliária boutique",
    },
  });

  const pw = hashPassword("nord2026");
  await db.insert(users).values([
    { name: "Marina Duarte", email: "marina@nordimoveis.com.br", role: "admin", creci: "112.334-F", passwordHash: pw },
    { name: "Rafael Costa", email: "rafael@nordimoveis.com.br", role: "corretor", creci: "198.442-F", passwordHash: pw },
    { name: "Ana Beatriz Mendes", email: "ana@nordimoveis.com.br", role: "corretor", creci: "167.023-J", passwordHash: pw },
  ]);

  console.log("seed: integrações…");
  await db.insert(integrations).values([
    {
      provider: "google_contacts",
      name: "Google Contacts",
      category: "google",
      connected: false,
      clientId: process.env.GOOGLE_CLIENT_ID ?? null,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/contacts",
      ],
      autoSync: false,
      syncIntervalMin: 30,
      statusMessage: "Configure as credenciais do Google Cloud e autorize a conta.",
    },
    {
      provider: "google_calendar",
      name: "Google Calendar",
      category: "google",
      connected: false,
      clientId: process.env.GOOGLE_CLIENT_ID ?? null,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
      calendarId: "primary",
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/calendar.events",
      ],
      autoSync: false,
      syncIntervalMin: 15,
      statusMessage: "Configure as credenciais do Google Cloud e autorize a conta.",
    },
    {
      provider: "whatsapp",
      name: "WhatsApp Business Cloud",
      category: "mensageria",
      connected: false,
      scopes: ["whatsapp_business_messaging"],
      syncIntervalMin: 60,
      statusMessage: "Aguardando credenciais do Meta Business.",
    },
    {
      provider: "s3",
      name: "Armazenamento de mídias (S3)",
      category: "infra",
      connected: true,
      accountEmail: "media@nordimoveis.com.br",
      clientId: "AKIA3MOCK7XQZ2EXAMPLE",
      clientSecret: "wJalrXUtnFEMI/K7MDENG/bPxRfi",
      accessToken: "s3-session-token-mock",
      scopes: ["s3:PutObject", "s3:GetObject"],
      autoSync: false,
      syncIntervalMin: 1440,
      lastSyncAt: new Date(Date.now() - 6 * 3600_000),
      lastSyncCount: 34,
      statusMessage: "Bucket nord-media-prod conectado (sa-east-1).",
    },
  ]);

  await db.insert(apiKeys).values([
    { label: "Site institucional", prefix: "imob_ro_4f21aa", secret: "b7d1e9c4a2f85306cd1194ab77e2f5a0", scope: "leitura" },
    { label: "Integração contábil", prefix: "imob_live_9c03de", secret: "1a4fbb27e8c60d95a3f27cc4190bd8e6", scope: "escrita" },
  ]);

  console.log("seed: imóveis…");
  const propsData: (typeof properties.$inferInsert & { images?: string[] })[] = [
    {
      code: "NRD-2401",
      title: "Casa Horizonte",
      type: "casa", purpose: "venda", status: "disponivel",
      price: 6_900_000, iptu: 32_000, area: 420, lotArea: 520,
      bedrooms: 4, suites: 3, bathrooms: 5, garage: 4,
      description:
        "Projeto vencedor de premiação nacional de arquitetura. Pé-direito de 5,4 m na sala, panos de vidro do piso ao teto e um jardim de inverno que atravessa o social.\n\nSuíte principal com closet de 18 m² e banheira com vista para o skyline. Automação completa de iluminação, cortinas e clima.",
      street: "Rua dos Ipês, 214", neighborhood: "Alto de Pinheiros",
      city: "São Paulo", state: "SP", lat: -23.5472, lng: -46.6847,
      features: ["Piscina", "Churrasqueira", "Jardim", "Home office", "Automação", "Energia solar"],
      images: [E(8134821), E(8089172), E(7167073), E(7173666)],
    },
    {
      code: "NRD-2402",
      title: "Apartamento Itaim 118",
      type: "apartamento", purpose: "venda", status: "disponivel",
      price: 2_450_000, condoFee: 1_890, iptu: 4_200, area: 118,
      bedrooms: 3, suites: 2, bathrooms: 2, garage: 2,
      description:
        "Andar alto, frente para nascente. Living integrado à varanda gourmet com fechamento em vidro retrátil.\n\nCondomínio com academia completa, piscina raia de 25 m e salão de festas assinado.",
      street: "Rua Clodomiro Amazonas, 900", neighborhood: "Itaim Bibi",
      city: "São Paulo", state: "SP", lat: -23.5848, lng: -46.6786,
      features: ["Varanda gourmet", "Academia", "Portaria 24h", "Pet friendly", "Cozinha integrada"],
      images: [E(28449782), E(7167073), E(7533848), E(7587783)],
    },
    {
      code: "NRD-2403",
      title: "Cobertura Jardins Sky",
      type: "cobertura", purpose: "venda", status: "disponivel",
      price: 8_750_000, condoFee: 4_900, iptu: 28_000, area: 380,
      bedrooms: 4, suites: 3, bathrooms: 5, garage: 4,
      description:
        "Cobertura duplex com terraço de 120 m², piscina privativa e vista 270° dos Jardins à Paulista.\n\nAndar íntimo com 3 suítes; andar social em conceito aberto com lareira e adega climatizada para 600 rótulos.",
      street: "Alameda Santos, 1150", neighborhood: "Jardins",
      city: "São Paulo", state: "SP", lat: -23.5656, lng: -46.6552,
      features: ["Piscina", "Vista livre", "Elevador", "Lareira", "Mobiliado", "Automação"],
      images: [E(15408878), E(7546553), E(6636314), E(7173666)],
    },
    {
      code: "NRD-2404",
      title: "Residência Jardim Europa",
      type: "casa", purpose: "venda", status: "reservado",
      price: 12_500_000, iptu: 74_000, area: 780, lotArea: 1_100,
      bedrooms: 6, suites: 5, bathrooms: 8, garage: 8,
      description:
        "Uma das poucas casas de rua arborizada no miolo do Jardim Europa. Salão principal com 9 m de vão livre, galeria de 20 m e piscina de borda infinita aquecida.\n\nAnexo de hóspedes, spa com sauna seca e úmida e casa de caseiro independente.",
      street: "Rua Groenlândia, 480", neighborhood: "Jardim Europa",
      city: "São Paulo", state: "SP", lat: -23.5766, lng: -46.6840,
      features: ["Piscina", "Jardim", "Lareira", "Academia", "Churrasqueira", "Salão de festas", "Portaria 24h"],
      images: [E(8134750), E(7534560), E(8089172), E(7533848)],
    },
    {
      code: "NRD-2405",
      title: "Estúdio Vila Madalena",
      type: "estudio", purpose: "aluguel", status: "disponivel",
      price: 3_200, condoFee: 650, area: 42,
      bedrooms: 1, suites: 0, bathrooms: 1, garage: 1,
      description:
        "Estúdio mobiliado a 400 m do metrô Vila Madalena. Marcenaria sob medida, varanda com vista para a cidade e internet fibra inclusa.\n\nPrédio com lavanderia compartilhada, bicicletário e lounge de coworking.",
      street: "Rua Harmonia, 320", neighborhood: "Vila Madalena",
      city: "São Paulo", state: "SP", lat: -23.5578, lng: -46.6875,
      features: ["Mobiliado", "Academia", "Portaria 24h", "Pet friendly"],
      images: [E(6489096), E(7533848)],
    },
    {
      code: "NRD-2406",
      title: "Apartamento Moema Garden",
      type: "apartamento", purpose: "venda", status: "vendido",
      price: 1_680_000, condoFee: 1_400, iptu: 3_100, area: 96,
      bedrooms: 3, suites: 1, bathrooms: 2, garage: 2,
      description:
        "Planta inteligente com living amplo e varanda integrada. Andar intermediário, silencioso e ensolarado.\n\nA duas quadras do Parque Ibirapuera — o melhor de Moema a pé.",
      street: "Alameda dos Anapurus, 1450", neighborhood: "Moema",
      city: "São Paulo", state: "SP", lat: -23.6012, lng: -46.6647,
      features: ["Varanda gourmet", "Playground", "Portaria 24h"],
      images: [E(7534560), E(7587783), E(8089155)],
    },
    {
      code: "NRD-2407",
      title: "Casa Refúgio da Serra",
      type: "casa", purpose: "venda", status: "disponivel",
      price: 3_980_000, iptu: 15_000, area: 560, lotArea: 1_200,
      bedrooms: 5, suites: 4, bathrooms: 6, garage: 6,
      description:
        "Em condomínio fechado com clube completo, rodeada de mata preservada. Madeira de demolição, pedra e vidro em composição contemporânea.\n\nA 40 minutos da capital — o fim de semana que virou endereço.",
      street: "Estrada do Golf, 88", neighborhood: "Granja Viana",
      city: "Cotia", state: "SP", lat: -23.5930, lng: -46.8970,
      features: ["Piscina", "Jardim", "Lareira", "Churrasqueira", "Vista livre", "Energia solar"],
      images: [E(7031606), E(8089172), E(6636314), E(7534560)],
    },
    {
      code: "NRD-2408",
      title: "Cobertura Brooklin Jardim",
      type: "cobertura", purpose: "venda", status: "disponivel",
      price: 4_290_000, condoFee: 2_800, iptu: 12_600, area: 245,
      bedrooms: 3, suites: 2, bathrooms: 4, garage: 3,
      description:
        "Cobertura de canto com jardim vertical de 40 m² e deck molhado. Vista definitiva para o parque Burle Marx.\n\nEntregue com automação, sonorização e ar central em todos os ambientes.",
      street: "Rua Joaquim Nabuco, 710", neighborhood: "Brooklin",
      city: "São Paulo", state: "SP", lat: -23.6108, lng: -46.6878,
      features: ["Vista livre", "Jardim", "Automação", "Varanda gourmet", "Ar-condicionado"],
      images: [E(7031604), E(6636314), E(7546553), E(8089155)],
    },
    {
      code: "NRD-2409",
      title: "Apartamento Higienópolis Clássico",
      type: "apartamento", purpose: "aluguel", status: "disponivel",
      price: 12_500, condoFee: 2_900, area: 210,
      bedrooms: 4, suites: 2, bathrooms: 4, garage: 3,
      description:
        "Clássico da Rua Piauí: pé-direito de 3,1 m, taco original restaurado, hall privativo e dois elevadores por unidade.\n\nDisponível mobiliado ou vazio a partir do próximo mês.",
      street: "Rua Piauí, 315", neighborhood: "Higienópolis",
      city: "São Paulo", state: "SP", lat: -23.5518, lng: -46.6572,
      features: ["Mobiliado", "Elevador", "Portaria 24h", "Aquecimento a gás"],
      images: [E(8089155), E(7167073), E(7587783), E(15408878)],
    },
    {
      code: "NRD-2410",
      title: "Terreno Alphaville Reserva",
      type: "terreno", purpose: "venda", status: "disponivel",
      price: 2_150_000, area: 750, lotArea: 750,
      bedrooms: 0, suites: 0, bathrooms: 0, garage: 0,
      description:
        "Terreno plano em ponto alto do Reserva, com escritura pronta e aprovação para projeto de até 3 pavimentos.\n\nCondomínio com segurança 24h, lagos e ciclovia de 8 km.",
      street: "Alameda das Palmeiras", neighborhood: "Alphaville",
      city: "Barueri", state: "SP", lat: -23.4876, lng: -46.8564,
      features: ["Portaria 24h", "Vista livre", "Jardim"],
      images: [E(9173035)],
    },
  ];

  const propIds: Record<string, string> = {};
  for (const { images, ...p } of propsData) {
    const [row] = await db.insert(properties).values(p).returning();
    propIds[p.code] = row.id;
    if (images?.length) {
      await db.insert(propertyImages).values(
        images.map((url, i) => ({ propertyId: row.id, url, position: i })),
      );
    }
  }

  console.log("seed: contatos…");
  const contactsData: typeof contacts.$inferInsert[] = [
    { name: "Helena Duarte", phone: "(11) 98321-4477", email: "helena.duarte@gmail.com", type: "lead", source: "site", budgetMin: 2_000_000, budgetMax: 3_000_000, interestTypes: ["apartamento"], neighborhoods: ["Itaim Bibi", "Moema"], notes: "Mudança em 6 meses; prefere andar alto e varanda." },
    { name: "Carlos Albuquerque", phone: "(11) 97712-8830", email: "calbuquerque@fcm.com.br", type: "cliente", source: "portal", budgetMin: 6_000_000, budgetMax: 9_000_000, interestTypes: ["casa", "cobertura"], neighborhoods: ["Jardim Europa", "Alto de Pinheiros", "Jardins"] },
    { name: "Fernanda Lins", phone: "(11) 96544-2210", email: "fe.lins@icloud.com", type: "lead", source: "whatsapp", budgetMax: 1_800_000, interestTypes: ["apartamento"], neighborhoods: ["Moema", "Brooklin"] },
    { name: "Roberto Siqueira", phone: "(11) 99903-5567", email: "r.siqueira@terra.com.br", type: "proprietario", source: "indicacao", notes: "Proprietário de 2 imóveis para colocar em captação exclusiva." },
    { name: "Mariana Tavares", phone: "(11) 98830-1145", email: "mariana.tavares@outlook.com", type: "lead", source: "site", budgetMin: 3_500_000, budgetMax: 5_000_000, interestTypes: ["casa"], neighborhoods: ["Granja Viana", "Alphaville"] },
    { name: "João Pedro Vasconcellos", phone: "(11) 97144-9982", email: "jp.vasconcellos@gmail.com", type: "cliente", source: "site", budgetMin: 8_000_000, budgetMax: 12_000_000, interestTypes: ["cobertura"], neighborhoods: ["Jardins"] },
    { name: "Beatriz Camargo", phone: "(11) 95221-7734", email: "bia.camargo@uol.com.br", type: "lead", source: "portal", budgetMax: 800_000, interestTypes: ["estudio", "apartamento"], neighborhoods: ["Vila Madalena", "Pinheiros"] },
    { name: "Eduardo Martins", phone: "(11) 98477-3320", email: "edu.martins@me.com", type: "proprietario", source: "visita" },
    { name: "Sofia Andrade", phone: "(11) 96655-8801", email: "sofia.andrade@gmail.com", type: "lead", source: "whatsapp", budgetMin: 2_400_000, budgetMax: 4_000_000, interestTypes: ["apartamento", "cobertura"], neighborhoods: ["Brooklin", "Itaim Bibi"] },
    { name: "Thiago Nogueira", phone: "(11) 94218-6673", email: "tnogueira@globomail.com", type: "lead", source: "site", budgetMax: 13_000, interestTypes: ["apartamento"], neighborhoods: ["Higienópolis", "Consolação"], notes: "Busca aluguel mobiliado por contrato de trabalho de 2 anos." },
  ];
  const contactIds: string[] = [];
  for (const c of contactsData) {
    const [row] = await db.insert(contacts).values(c).returning();
    contactIds.push(row.id);
  }

  console.log("seed: visitas…");
  const at = (daysFromNow: number, h: number, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const visitsData: typeof visits.$inferInsert[] = [
    { propertyId: propIds["NRD-2402"], contactId: contactIds[0], scheduledAt: at(-2, 10), status: "realizada", feedback: "Adorou a varanda. Vai simular financiamento." },
    { propertyId: propIds["NRD-2406"], contactId: contactIds[0], scheduledAt: at(-1, 15), status: "realizada" },
    { propertyId: propIds["NRD-2401"], contactId: contactIds[1], scheduledAt: at(0, 14), status: "confirmada" },
    { propertyId: propIds["NRD-2403"], contactId: contactIds[5], scheduledAt: at(1, 10), status: "confirmada" },
    { propertyId: propIds["NRD-2408"], contactId: contactIds[8], scheduledAt: at(1, 16), status: "agendada" },
    { propertyId: propIds["NRD-2407"], contactId: contactIds[4], scheduledAt: at(2, 9), status: "agendada" },
    { propertyId: propIds["NRD-2405"], contactId: contactIds[9], scheduledAt: at(2, 18), status: "agendada" },
    { propertyId: propIds["NRD-2402"], contactId: contactIds[2], scheduledAt: at(-3, 11), status: "cancelada", feedback: "Cliente remarcou para a próxima semana." },
    { propertyId: propIds["NRD-2409"], contactId: contactIds[9], scheduledAt: at(3, 15), status: "agendada" },
    { propertyId: propIds["NRD-2403"], contactId: contactIds[1], scheduledAt: at(4, 11), status: "agendada" },
  ];
  const visitIds: string[] = [];
  for (const v of visitsData) {
    const [row] = await db.insert(visits).values(v).returning();
    visitIds.push(row.id);
  }

  console.log("seed: pipeline…");
  const dealsData: typeof deals.$inferInsert[] = [
    { contactId: contactIds[0], propertyId: propIds["NRD-2402"], stage: "proposta", value: 2_350_000 },
    { contactId: contactIds[5], propertyId: propIds["NRD-2403"], stage: "visita", value: 8_750_000 },
    { contactId: contactIds[1], propertyId: propIds["NRD-2404"], stage: "documentacao", value: 12_200_000 },
    { contactId: contactIds[8], propertyId: propIds["NRD-2408"], stage: "visita", value: 4_290_000 },
    { contactId: contactIds[2], propertyId: propIds["NRD-2406"], stage: "contato", value: 1_680_000 },
    { contactId: contactIds[4], propertyId: propIds["NRD-2407"], stage: "contato", value: 3_980_000 },
    { contactId: contactIds[6], propertyId: propIds["NRD-2405"], stage: "novo", value: 3_200 },
    { contactId: contactIds[9], propertyId: propIds["NRD-2409"], stage: "novo", value: 12_500 },
    { contactId: contactIds[1], propertyId: propIds["NRD-2401"], stage: "fechado", value: 6_750_000 },
  ];
  for (const d of dealsData) await db.insert(deals).values(d).returning();

  console.log("seed: analytics de imóveis…");
  const visitors = Array.from({ length: 60 }, () => randomUUID());
  const viewRows: (typeof propertyViews.$inferInsert)[] = [];
  for (const id of Object.values(propIds)) {
    const popularity = 0.5 + Math.random() * 0.8;
    const total = Math.round((18 + Math.random() * 50) * popularity);
    for (let i = 0; i < total; i += 1) {
      // viés para dias recentes (curva de interesse decay)
      const daysAgo = Math.floor(Math.pow(Math.random(), 1.6) * 30);
      const d = new Date(
        Date.now() - daysAgo * 864e5 - Math.random() * 43_200_000,
      );
      viewRows.push({
        propertyId: id,
        visitorId: visitors[Math.floor(Math.random() * visitors.length)],
        createdAt: d,
      });
    }
  }
  await db.insert(propertyViews).values(viewRows);

  console.log("seed: portais…");
  await db.insert(portals).values([
    { slug: "zap", name: "ZAP Imóveis", enabled: true, status: "conectado", listings: 8, lastSyncAt: at(0, -3), apiKey: "zap_pk_live_51Hz••••••••Ku2m" },
    { slug: "olx", name: "OLX", enabled: true, status: "conectado", listings: 8, lastSyncAt: at(0, -3), apiKey: "olx_sk_9f2c••••••••88AB" },
    { slug: "vivareal", name: "VivaReal", enabled: false, status: "desconectado", listings: 0, apiKey: null },
    { slug: "quintoandar", name: "QuintoAndar", enabled: false, status: "desconectado", listings: 0, apiKey: null },
  ]);

  console.log("seed: linha do tempo…");
  const ago = (mins: number) => new Date(Date.now() - mins * 60_000);
  const acts: typeof activities.$inferInsert[] = [
    { entity: "portal", kind: "sync", text: "Sincronização com ZAP Imóveis concluída — 8 anúncios enviados via feed XML.", createdAt: ago(42) },
    { entity: "imovel", entityId: propIds["NRD-2402"], kind: "pdf", text: "Ficha PDF do imóvel NRD-2402 gerada e enviada para Helena Duarte.", createdAt: ago(95) },
    { entity: "contato", entityId: contactIds[0], kind: "message", text: "Helena Duarte respondeu no WhatsApp: \"Amei a cozinha integrada!\".", createdAt: ago(150) },
    { entity: "visita", entityId: visitIds[2], kind: "visit", text: "Visita confirmada: Carlos Albuquerque · NRD-2401 · hoje às 14:00.", createdAt: ago(180) },
    { entity: "negocio", kind: "stage", text: "Negociação de Carlos Albuquerque (NRD-2404) movida para “Documentação”.", createdAt: ago(320) },
    { entity: "contato", entityId: contactIds[8], kind: "lead", text: "Sofia Andrade entrou para a agenda (origem: whatsapp).", createdAt: ago(410) },
    { entity: "imovel", entityId: propIds["NRD-2410"], kind: "created", text: "Imóvel NRD-2410 cadastrado por Ana Beatriz Mendes.", createdAt: ago(560) },
    { entity: "visita", entityId: visitIds[7], kind: "visit", text: "Visita cancelada: Fernanda Lins · NRD-2402 — cliente remarcou.", createdAt: ago(700) },
    { entity: "imovel", entityId: propIds["NRD-2403"], kind: "updated", text: "Ficha do imóvel NRD-2403 atualizada: novas fotos do terraço.", createdAt: ago(900) },
    { entity: "negocio", kind: "stage", text: "Negociação de Helena Duarte (NRD-2402) movida para “Proposta”.", createdAt: ago(1250) },
    { entity: "portal", kind: "sync", text: "Sincronização com OLX concluída — 8 anúncios enviados via feed XML.", createdAt: ago(1400) },
    { entity: "contato", entityId: contactIds[2], kind: "lead", text: "Fernanda Lins entrou para a agenda (origem: whatsapp).", createdAt: ago(1700) },
    { entity: "sistema", kind: "created", text: "Ana Beatriz Mendes entrou para a equipe como corretora.", createdAt: ago(2100) },
    { entity: "imovel", entityId: propIds["NRD-2408"], kind: "created", text: "Imóvel NRD-2408 cadastrado por Rafael Costa.", createdAt: ago(2500) },
    { entity: "negocio", kind: "stage", text: "Negociação de Carlos Albuquerque (NRD-2401) fechada! VGV confirmado.", createdAt: ago(4300) },
    { entity: "imovel", entityId: propIds["NRD-2406"], kind: "updated", text: "Imóvel NRD-2406 marcado como vendido.", createdAt: ago(4300) },
    { entity: "contato", entityId: contactIds[6], kind: "lead", text: "Beatriz Camargo entrou para a agenda (origem: portal).", createdAt: ago(5200) },
  ];
  await db.insert(activities).values(acts);

  console.log("seed concluído ✔");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
