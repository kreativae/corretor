import { MarketMap } from "@/components/crm/market-map";
import { geoKey } from "@/lib/market";
import { loadMarketSamples, loadRegionGeo } from "@/lib/market-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Valor do m²" };

export default async function ValorM2Page() {
  const samples = await loadMarketSamples();
  const now = new Date().getTime();
  const keys = [...new Set(samples.map((s) => geoKey(s, s.rural)))];
  const geo = await loadRegionGeo(keys);
  return (
    <div className="mx-auto max-w-7xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">Análise de mercado</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Valor do m²</h1>
      <p className="mt-1 max-w-2xl text-sm text-subtle">
        Mediana do valor por região, a partir dos imóveis da carteira, dos negócios fechados e das amostras de mercado
        que você registra.
      </p>
      <MarketMap samples={samples} geo={geo} now={now} />
    </div>
  );
}
