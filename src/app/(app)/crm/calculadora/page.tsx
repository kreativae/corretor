import { Calculators } from "@/components/crm/calculators";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calculadora" };

export default function CalculadoraPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Calculators />
    </div>
  );
}
