import { listPublishedProperties, getWhiteLabel } from "@/lib/queries";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [wl, props] = await Promise.all([
    getWhiteLabel(),
    listPublishedProperties(),
  ]);

  const baseUrl = `https://${wl.domain}`;

  const items = props
    .map((p) => {
      const images = p.images
        .map(
          (i) =>
            `        <Item medium="image" caption="${esc(p.title)}" primary="${i.position === 0 ? "true" : "false"}">${esc(i.url)}</Item>`,
        )
        .join("\n");

      const featuresXml = p.features.length
        ? `\n        <Features>\n${p.features.map((f) => `          <Feature>${esc(f)}</Feature>`).join("\n")}\n        </Features>`
        : "";

      return `    <Listing>
      <ListingID>${esc(p.code)}</ListingID>
      <Title>${esc(p.title)}</Title>
      <TransactionType>${p.purpose === "venda" ? "For Sale" : "For Rent"}</TransactionType>
      <PublicationType>STANDARD</PublicationType>
      
      <Details>
        <PropertyType>${esc(p.type)}</PropertyType>
        <Description>${esc(p.description || p.title)}</Description>
        <ListPrice currency="BRL">${p.price}</ListPrice>
        ${p.condoFee ? `<AdministrationFee currency="BRL">${p.condoFee}</AdministrationFee>` : ""}
        ${p.iptu ? `<YearlyTax currency="BRL">${p.iptu}</YearlyTax>` : ""}
        <LivingArea unit="square metres">${p.area}</LivingArea>
        ${p.lotArea ? `<LotArea unit="square metres">${p.lotArea}</LotArea>` : ""}
        <Bedrooms>${p.bedrooms}</Bedrooms>
        <Suites>${p.suites}</Suites>
        <Bathrooms>${p.bathrooms}</Bathrooms>
        <Garage>${p.garage}</Garage>${featuresXml}
      </Details>

      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="${esc(p.state)}">${esc(p.state)}</State>
        <City>${esc(p.city)}</City>
        <Neighborhood>${esc(p.neighborhood)}</Neighborhood>
        ${p.street ? `<Address>${esc(p.street)}</Address>` : ""}
        ${p.lat ? `<Latitude>${p.lat}</Latitude>` : ""}
        ${p.lng ? `<Longitude>${p.lng}</Longitude>` : ""}
      </Location>

      <Media>
${images}
      </Media>

      <ContactInfo>
        <Name>${esc(wl.orgName)}</Name>
        <Email>contato@${esc(wl.domain)}</Email>
        <Telephone>+${esc(wl.phone)}</Telephone>
        <Website>${esc(baseUrl)}</Website>
        <Logo>${esc(baseUrl)}/icon.svg</Logo>
      </ContactInfo>

      <PropertyURL>${esc(baseUrl)}/imoveis/${esc(p.code)}</PropertyURL>
      <PublicationDate>${p.createdAt.toISOString()}</PublicationDate>
      <LastUpdateDate>${p.updatedAt.toISOString()}</LastUpdateDate>
    </Listing>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd"
                 version="2.0">
  <Header>
    <Provider>${esc(wl.orgName)}</Provider>
    <Email>integracao@${esc(wl.domain)}</Email>
    <ContactName>${esc(wl.orgName)}</ContactName>
    <PublishDate>${new Date().toISOString()}</PublishDate>
    <TotalListings>${props.length}</TotalListings>
  </Header>
  <Listings>
${items}
  </Listings>
</ListingDataFeed>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
