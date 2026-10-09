export default function ImoveisLoading() {
  return (
    <div className="container-x animate-pulse pb-24 pt-28 md:pt-36">
      <div className="h-3 w-40 rounded-full bg-soft" />
      <div className="mt-4 h-14 w-96 max-w-full rounded-2xl bg-soft" />
      <div className="mt-10 flex gap-3">
        <div className="h-10 w-64 rounded-xl bg-soft" />
        <div className="h-10 w-40 rounded-xl bg-soft" />
        <div className="h-10 w-32 rounded-xl bg-soft" />
      </div>
      <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/3] rounded-2xl bg-soft" />
            <div className="mt-4 h-3 w-24 rounded-full bg-soft" />
            <div className="mt-2 h-5 w-48 rounded-lg bg-soft" />
            <div className="mt-2 h-3 w-36 rounded-full bg-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}
