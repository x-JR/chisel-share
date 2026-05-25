'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_liked', label: 'Most Liked' },
] as const;

type SortOption = (typeof OPTIONS)[number]['value'];

interface Props {
  currentSort: SortOption;
}

export default function SortSelector({ currentSort }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    document.cookie = `sort_pref=${value}; max-age=31536000; path=/; SameSite=Lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.set('page', '1');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <label htmlFor="sort-by">Sort by</label>
      <select
        id="sort-by"
        value={currentSort}
        onChange={handleChange}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
