import { MarketMap } from "@/components/crm/market-map";
import { geoKey } from "@/lib/market";
import { loadMarketSamples, loadRegionGeo } from "@/lib/market-data";
import { getMapProvider, tilesFor } from "@/lib/map-provider";
import { backfillPropertyGeo } from "@/lib/property-geo";
import { after } from "next/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Valor do m²" };

export default async function ValorM2Page() {
  const samples = await loadMarketSamples();
  // Imóveis cadastrados antes de existir o ponto pelo endereço: localiza alguns por visita
  after(() => backfillPropertyGeo());
  const now = new Date().getTime();
  const regions = [...new Map(samples.map((s) => [geoKey(s, s.rural), { key: geoKey(s, s.rural), city: s.city, state: s.state }])).values()];
  const [geo, mapCfg] = await Promise.all([loadRegionGeo(regions), getMapProvider()]);
  return (
    <div className="mx-auto max-w-7xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">Análise de mercado</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Valor do m²</h1>
      <p className="mt-1 max-w-2xl text-sm text-subtle">
        Mediana do valor por região, a partir dos imóveis da carteira, dos negócios fechados e das amostras de mercado
        que você registra.
      </p>
      <MarketMap samples={samples} geo={geo} now={now} tiles={tilesFor(mapCfg)} />
    </div>
  );
}
