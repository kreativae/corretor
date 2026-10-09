export default function CrmLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-8">
      <div className="space-y-3">
        <div className="h-3 w-40 rounded-full bg-soft" />
        <div className="h-9 w-72 rounded-xl bg-soft" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-hairline bg-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-96 rounded-2xl border border-hairline bg-card" />
        <div className="h-96 rounded-2xl border border-hairline bg-card" />
      </div>
    </div>
  );
}
