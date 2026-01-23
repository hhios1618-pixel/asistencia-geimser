import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Database } from '../../types/database'; // Adjust import based on actual types location if needed

export default async function DtLayout({ children }: { children: React.ReactNode }) {
    // We can add global checks here if needed, but for now we just pass through.
    // The specific page protections will happen in page.tsx or middleware.
    // Ideally, we check for session here.

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-slate-800">Portal de Fiscalización</span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">DT</span>
                    </div>
                    <div className="text-xs text-slate-500">
                        Cumplimiento Res. Exenta N° 38
                    </div>
                </div>
            </header>
            <main>
                {children}
            </main>
        </div>
    );
}
