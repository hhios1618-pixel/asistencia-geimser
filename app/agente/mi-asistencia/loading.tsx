export default function MiAsistenciaLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center border-b border-white/5 bg-[#05060A]/80 px-6 py-4 backdrop-blur-xl md:px-10">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
          <div className="h-7 w-40 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto w-full max-w-[1400px] flex flex-col gap-4 animate-pulse">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-12 rounded-2xl bg-white/5" />
          ))}
        </div>
      </main>
    </>
  );
}
