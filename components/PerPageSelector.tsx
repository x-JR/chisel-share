'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [12, 24, 48, 100] as const;

interface Props {
  currentLimit: number;
}

export default function PerPageSelector({ currentLimit }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', e.target.value);
    params.set('page', '1');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <label htmlFor="per-page">Per page</label>
      <select
        id="per-page"
        value={currentLimit}
        onChange={handleChange}
        className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
