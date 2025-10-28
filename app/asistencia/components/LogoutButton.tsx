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
      className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
    >
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

export default LogoutButton;
