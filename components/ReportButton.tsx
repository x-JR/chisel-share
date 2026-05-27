'use client';

import { useState, useEffect } from 'react';

const REPORT_REASONS = [
  { value: 'offensive', label: 'Offensive / Inappropriate' },
  { value: 'spam', label: 'Spam' },
  { value: 'broken_textures', label: 'Broken Textures' },
] as const;

interface Props {
  collectionId: string;
}

export default function ReportButton({ collectionId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('offensive');
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist reported state across navigation
  useEffect(() => {
    try {
      const key = `reported:${collectionId}`;
      if (sessionStorage.getItem(key) === '1') setReported(true);
    } catch { /* sessionStorage unavailable */ }
  }, [collectionId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.status === 409 || res.ok) {
        try { sessionStorage.setItem(`reported:${collectionId}`, '1'); } catch { /* ok */ }
        setReported(true);
        setOpen(false);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Failed to submit report');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (reported) {
    return (
      <button
        disabled
        className="flex items-center justify-center gap-2 w-full h-full py-2.5 rounded-lg border font-medium text-sm bg-slate-800 border-slate-700 text-slate-500 cursor-default opacity-60"
      >
        ⚑ Reported
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setError(null); }}
        className="flex items-center justify-center gap-2 w-full h-full py-2.5 rounded-lg border font-medium text-sm transition-colors bg-slate-800 border-slate-700 text-slate-400 hover:border-red-700/60 hover:text-red-400"
      >
        ⚑ Report
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown panel */}
          <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-4 space-y-3">
            <h3 className="text-slate-200 font-semibold text-sm">Report this collection</h3>
            <p className="text-slate-500 text-xs">
              Select a reason and we&apos;ll review it.
            </p>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-amber-500"
                  />
                  <span className="text-slate-300 text-sm group-hover:text-slate-100 transition-colors">
                    {r.label}
                  </span>
                </label>
              ))}
            </div>
            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2 rounded-lg border border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
