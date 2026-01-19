'use client';

import { useRouter } from 'next/navigation';

export function BackButton({ fallbackHref = '/asistencia' }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.75)] transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15 hover:text-white"
    >
      Volver
    </button>
  );
}

export default BackButton;

