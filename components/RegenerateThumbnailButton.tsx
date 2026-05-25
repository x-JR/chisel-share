'use client';

import { useState } from 'react';
import { captureThumbnail } from '@/lib/capture-thumbnail-client';

interface Props {
  id: string;
}

type Status = 'idle' | 'fetching' | 'rendering' | 'uploading' | 'ok' | 'error';

const LABELS: Record<Status, string> = {
  idle: 'Regenerate Thumbnail',
  fetching: 'Fetching schematic…',
  rendering: 'Rendering 3D preview…',
  uploading: 'Saving…',
  ok: 'Regenerate Thumbnail',
  error: 'Regenerate Thumbnail',
};

export default function RegenerateThumbnailButton({ id }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const busy = status === 'fetching' || status === 'rendering' || status === 'uploading';

  async function handleClick() {
    setErrorMsg(null);
    try {
      // 1. Fetch the schematic XML
      setStatus('fetching');
      const xmlRes = await fetch(`/api/schematics/${id}`);
      if (!xmlRes.ok) throw new Error('Could not fetch schematic');
      const { xmlContent } = await xmlRes.json() as { xmlContent: string };

      // 2. Render with Three.js
      setStatus('rendering');
      const blob = await captureThumbnail(xmlContent);
      if (!blob) throw new Error('Rendering produced no output');

      // 3. Upload the PNG
      setStatus('uploading');
      const form = new FormData();
      form.append('thumbnail', blob, 'thumbnail.png');
      const uploadRes = await fetch(`/api/schematics/${id}/thumb`, {
        method: 'POST',
        body: form,
      });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Upload failed');
      }

      setStatus('ok');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleClick}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
          bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/50
          text-amber-300 text-sm font-medium transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {LABELS[status]}
          </>
        ) : (
          <>
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            {LABELS[status]}
          </>
        )}
      </button>
      {status === 'ok' && (
        <p className="text-emerald-400 text-xs text-center">
          Thumbnail updated — reload the page to see it.
        </p>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-red-400 text-xs text-center">{errorMsg}</p>
      )}
    </div>
  );
}
