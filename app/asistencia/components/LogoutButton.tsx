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
      className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"
    >
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

export default LogoutButton;
