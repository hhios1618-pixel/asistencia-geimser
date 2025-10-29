'use client';

interface Props {
  receiptUrl: string | null;
}

export function ProofReceiptButton({ receiptUrl }: Props) {
  if (!receiptUrl) {
    return <span className="text-xs font-medium text-slate-400">Sin recibo</span>;
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
      onClick={() => window.open(receiptUrl, '_blank', 'noopener')}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3.5 w-3.5">
        <path d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 4v3h3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 11H13M6.5 13.5H11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Ver recibo
    </button>
  );
}

export default ProofReceiptButton;
