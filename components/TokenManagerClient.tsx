'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  currentToken: string | null;
}

export default function TokenManagerClient({ currentToken }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  async function handleCopy() {
    if (!currentToken) return;
    await navigator.clipboard.writeText(currentToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleImport() {
    const token = importValue.trim();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to import token');
      } else {
        setImportValue('');
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/token', { method: 'POST' });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setError(null); setImportValue(''); }}
        title="Manage your uploader token"
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <span>🔑</span>
        <span className="hidden sm:inline">My Token</span>
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="absolute right-0 top-12 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-4 space-y-4"
        >
          <h3 className="text-slate-200 font-semibold text-sm">Uploader Token</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            This token identifies you as the uploader of your schematics. Copy it to use on
            another machine, or paste one in to reclaim ownership.
          </p>

          {/* Current token display */}
          <div className="space-y-1">
            <span className="text-slate-500 text-xs">Your current token</span>
            {currentToken ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-800 text-amber-300 text-xs px-2.5 py-2 rounded-lg font-mono truncate select-all">
                  {currentToken}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-2 rounded-lg transition-colors"
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic">No token set yet. Upload a schematic to get one, or generate below.</p>
            )}
          </div>

          {/* Import a token */}
          <div className="space-y-1.5">
            <span className="text-slate-500 text-xs">Import token from another machine</span>
            <input
              type="text"
              placeholder="Paste token here…"
              value={importValue}
              onChange={(e) => { setImportValue(e.target.value); setError(null); }}
              className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 text-slate-100 text-xs px-2.5 py-2 rounded-lg outline-none font-mono placeholder-slate-600"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={handleImport}
              disabled={saving || !importValue.trim()}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Import Token'}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* Generate new */}
          <button
            onClick={handleGenerate}
            disabled={saving}
            className="w-full text-xs text-slate-400 hover:text-red-400 transition-colors text-center py-1 disabled:opacity-50"
          >
            Generate new token (clears ownership of existing uploads)
          </button>
        </div>
      )}
    </div>
  );
}
