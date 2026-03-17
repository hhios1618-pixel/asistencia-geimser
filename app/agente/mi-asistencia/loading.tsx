export default function MiAsistenciaLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-10 w-56 rounded-xl bg-white/5" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}
