'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteCollectionButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setDeleting(false);
        setConfirming(false);
      }
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={[
        'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border font-medium text-sm transition-colors',
        confirming
          ? 'bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900/50'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300',
        deleting ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {deleting ? 'Deleting…' : confirming ? 'Confirm Delete' : '🗑 Delete Collection'}
    </button>
  );
}
