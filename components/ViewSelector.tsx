'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'schematics', label: 'Schematics' },
  { value: 'collections', label: 'Collections' },
] as const;

type ViewOption = (typeof OPTIONS)[number]['value'];

interface Props {
  currentView: ViewOption;
}

export default function ViewSelector({ currentView }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick(value: ViewOption) {
    if (value === currentView) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'both') {
      params.delete('view');
    } else {
      params.set('view', value);
    }
    params.set('page', '1');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span>Show</span>
      <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 p-0.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleClick(opt.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentView === opt.value
                ? 'bg-amber-600 text-white'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
