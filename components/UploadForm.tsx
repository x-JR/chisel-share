'use client';

import { useState, useRef, useCallback } from 'react';
import { captureThumbnail } from '@/lib/capture-thumbnail-client';
import { isChiselWizContent } from '@/lib/voxel-decoder';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [capturingThumb, setCapturingThumb] = useState(false);
  const [catalogueCount, setCatalogueCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setCatalogueCount(null);
    setThumbnailBlob(null);
    setCapturingThumb(true);
    try {
      const text = await f.text();
      // Detect multi-design Chisel Wiz catalogues before doing anything else
      if (isChiselWizContent(text)) {
        try {
          const data = JSON.parse(text);
          const count: number = Array.isArray(data?.designs) ? data.designs.length : 0;
          if (count > 1) {
            setCatalogueCount(count);
            setCapturingThumb(false);
            return;
          }
        } catch {
          // not valid JSON — let the server reject it
        }
      }
      const blob = await captureThumbnail(text);
      setThumbnailBlob(blob);
    } catch {
      // thumbnail capture failure is non-fatal
    } finally {
      setCapturingThumb(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (!displayName.trim()) {
        setError('Display name is required');
        setUploading(false);
        return;
      }
      formData.append('file', file);
      formData.append('display_name', displayName.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (authorName.trim()) formData.append('author_name', authorName.trim());
      if (thumbnailBlob) formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');

      const res = await fetch('/api/schematics', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error ?? 'Upload failed');
      }

      const data = await res.json();
      router.push(`/view/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Select schematic file"
        className={[
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none',
          dragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600 hover:border-slate-500',
          file ? '!border-green-600 !bg-green-600/10' : '',
        ].join(' ')}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.json"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
        />
        {capturingThumb ? (
          <div>
            <div className="text-amber-400 text-3xl mb-2 animate-spin">⟳</div>
            <p className="text-amber-400 font-medium">{file?.name}</p>
            <p className="text-slate-400 text-sm mt-1">Generating thumbnail…</p>
          </div>
        ) : file ? (
          <div>
            <div className="text-green-400 text-3xl mb-2">✓</div>
            <p className="text-green-400 font-medium">{file.name}</p>
            <p className="text-slate-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <div className="text-slate-400 text-4xl mb-3">📦</div>
            <p className="text-slate-300 font-medium">Drop your schematic here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse &mdash; QP Chisel (.xml) or Chisel Wiz (.json)</p>
          </div>
        )}
      </div>

      {/* Catalogue warning */}
      {catalogueCount !== null && (
        <div className="bg-amber-950 border border-amber-700 rounded-lg px-4 py-4 space-y-3">
          <p className="text-amber-300 text-sm font-medium">
            This file contains {catalogueCount} designs — it looks like a Chisel Wiz catalogue.
          </p>
          <p className="text-amber-400/80 text-sm">
            The <strong className="text-amber-300">Catalogue Tool</strong> can handle multi-design
            files: merge them with your existing catalogue, add designs from the gallery, or upload
            them all to the community at once.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/upload/chiselwiz"
              className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Open Catalogue Tool →
            </Link>
            <button
              type="button"
              onClick={() => setCatalogueCount(null)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Upload first design only
            </button>
          </div>
        </div>
      )}

      {/* Display name */}
      <div className={catalogueCount !== null ? 'hidden' : ''}>
        <label className="block text-slate-300 text-sm font-medium mb-1.5">
          Display Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Give your schematic a name"
          maxLength={100}
          required
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Description */}
      <div className={catalogueCount !== null ? 'hidden' : ''}>
        <label className="block text-slate-300 text-sm font-medium mb-1.5">
          Description <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell others about your creation…"
          maxLength={500}
          rows={3}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
        />
      </div>

      {/* Author */}
      <div className={catalogueCount !== null ? 'hidden' : ''}>
        <label className="block text-slate-300 text-sm font-medium mb-1.5">
          Author <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name or alias"
          maxLength={100}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {catalogueCount === null && (
        <button
          type="submit"
          disabled={uploading || capturingThumb || !file}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {uploading ? 'Uploading…' : capturingThumb ? 'Preparing…' : 'Upload Schematic'}
        </button>
      )}
    </form>
  );
}
