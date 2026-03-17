export default function AgenteLoading() {
  return (
    <>
      {/* PageHeader skeleton */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#05060A]/80 px-6 py-4 backdrop-blur-xl md:px-10">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
          <div className="h-7 w-40 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto w-full max-w-[1400px] flex flex-col gap-6 animate-pulse">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-48 rounded-2xl bg-white/5" />
            <div className="h-48 rounded-2xl bg-white/5" />
          </div>
        </div>
      </main>
    </>
  );
}
