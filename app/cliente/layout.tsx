import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal Cliente — Geimser RRHH',
  description: 'Acceso a documentos e información de su campaña',
};

// Layout completamente separado del sistema interno de Geimser.
// El cliente no ve ningún menú interno.
export default function ClienteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header minimalista del portal externo */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Geimser */}
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              G
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Portal de Cliente</p>
              <p className="text-slate-400 text-xs">Geimser RRHH</p>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-slate-600 text-xs">
        © {new Date().getFullYear()} Geimser. Portal seguro de acceso a documentos.
      </footer>
    </div>
  );
}
