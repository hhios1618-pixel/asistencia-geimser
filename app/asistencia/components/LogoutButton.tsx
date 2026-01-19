'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../../lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore sign-out errors to avoid blocking navigation
    } finally {
      setLoading(false);
      router.replace('/login');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.75)] transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15 hover:text-white disabled:opacity-50"
    >
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

export default LogoutButton;
