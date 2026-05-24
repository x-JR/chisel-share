'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ id }: { id: string }) {
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
      const res = await fetch(`/api/schematics/${id}`, { method: 'DELETE' });
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
      className={`w-full text-center font-medium py-2.5 rounded-lg transition-colors ${
        confirming
          ? 'bg-red-700 hover:bg-red-600 text-white'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
      }`}
    >
      {deleting ? 'Deleting…' : confirming ? 'Click again to confirm delete' : '🗑 Delete'}
    </button>
  );
}
