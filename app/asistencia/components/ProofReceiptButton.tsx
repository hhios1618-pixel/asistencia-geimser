'use client';

interface Props {
  receiptUrl: string | null;
}

export function ProofReceiptButton({ receiptUrl }: Props) {
  if (!receiptUrl) {
    return <span className="text-xs text-gray-400">Sin recibo</span>;
  }

  return (
    <button
      type="button"
      className="text-xs text-blue-600 underline"
      onClick={() => window.open(receiptUrl, '_blank', 'noopener')}
    >
      Ver recibo
    </button>
  );
}

export default ProofReceiptButton;

