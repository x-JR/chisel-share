'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface Props {
  defaultValue?: string;
}

export default function SearchBar({ defaultValue = '' }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function buildUrl(search: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set('search', search.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    return `/?${params.toString()}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl(value));
  }

  function handleClear() {
    setValue('');
    router.push(buildUrl(''));
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by name or description…"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-9 text-slate-200 placeholder-slate-500 transition-colors focus:border-amber-500/60 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-500 hover:text-slate-300"
          >
            ×
          </button>
        )}
      </div>
      <button
        type="submit"
        className="whitespace-nowrap rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-500"
      >
        Search
      </button>
    </form>
  );
}
