'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  collectionId: string;
  collectionName: string;
  label?: string;
  className?: string;
}

export default function CollectionDownloadButton({
  collectionId,
  collectionName,
  label = '⬇ Download All',
  className,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  async function download(format: 'qpchisel' | 'chiselwiz') {
    setShowPicker(false);
    setError(null);
    setLoading(true);
    const safeFilename = collectionName.replace(/[^a-zA-Z0-9 _-]/g, '_');
    const url =
      format === 'chiselwiz'
        ? `/api/collections/${collectionId}/download?format=chiselwiz`
        : `/api/collections/${collectionId}/download`;
    const filename = format === 'chiselwiz' ? `${safeFilename}.json` : `${safeFilename}.zip`;
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        setError(`Too many downloads — please wait ${seconds}s before trying again.`);
        return;
      }
      if (!res.ok) {
        setError('Download failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Download failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const defaultClass =
    'block w-full text-center bg-amber-600 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors';

  return (
    <div ref={ref} className="relative space-y-1.5">
      <button
        onClick={() => setShowPicker((v) => !v)}
        disabled={loading}
        className={className ?? defaultClass}
      >
        {loading ? 'Downloading…' : label}
      </button>
      {showPicker && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => download('qpchisel')}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors"
          >
            <span className="font-medium text-white">QP Chisel</span>
            <span className="text-slate-400 ml-1.5">.zip</span>
          </button>
          <div className="border-t border-slate-700" />
          <button
            onClick={() => download('chiselwiz')}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors"
          >
            <span className="font-medium text-white">Chisel Wiz</span>
            <span className="text-slate-400 ml-1.5">.json</span>
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}
