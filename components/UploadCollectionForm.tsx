'use client';

import { useState, useRef, useCallback } from 'react';
import { captureThumbnail } from '@/lib/capture-thumbnail-client';
import { useRouter } from 'next/navigation';

interface FilePart {
  file: File;
  displayName: string;
  description: string;
  thumbnailBlob: Blob | null;
  capturingThumb: boolean;
}

export default function UploadCollectionForm() {
  const [parts, setParts] = useState<FilePart[]>([]);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    // Seed the parts array first so the UI is responsive
    setParts((prev) => [
      ...prev,
      ...incoming.map((f) => ({
        file: f,
        displayName: f.name.replace(/\.[^.]+$/, ''),
        description: '',
        thumbnailBlob: null,
        capturingThumb: true,
      })),
    ]);

    // Capture thumbnails and auto-read display names from XML
    for (const f of incoming) {
      const idx = parts.length + incoming.indexOf(f);
      try {
        const text = await f.text();
        // Extract <name> from XML for a better default display name
        const nameMatch = text.match(/<name[^>]*>(.*?)<\/name>/i);
        const xmlName = nameMatch?.[1]?.trim();
        const blob = await captureThumbnail(text).catch(() => null);

        setParts((prev) =>
          prev.map((p, i) =>
            i === idx
              ? {
                  ...p,
                  displayName: xmlName || p.displayName,
                  thumbnailBlob: blob,
                  capturingThumb: false,
                }
              : p
          )
        );
      } catch {
        setParts((prev) =>
          prev.map((p, i) => (i === idx ? { ...p, capturingThumb: false } : p))
        );
      }
    }
  }, [parts.length]);

  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  function movePart(from: number, to: number) {
    setParts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function updatePart(index: number, field: 'displayName' | 'description', value: string) {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!collectionName.trim()) {
      setError('Collection name is required');
      return;
    }
    if (parts.length === 0) {
      setError('Add at least one schematic file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', collectionName.trim());
      if (collectionDescription.trim())
        formData.append('description', collectionDescription.trim());
      formData.append('count', String(parts.length));

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        formData.append(`file_${i}`, p.file);
        formData.append(`display_name_${i}`, p.displayName.trim() || p.file.name);
        if (p.description.trim()) formData.append(`description_${i}`, p.description.trim());
        if (p.thumbnailBlob) formData.append(`thumbnail_${i}`, p.thumbnailBlob, 'thumbnail.png');
      }

      const res = await fetch('/api/collections', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error ?? 'Upload failed');
      }

      const data = await res.json();
      router.push(`/view/collection/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Collection metadata */}
      <div className="space-y-4">
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">
            Collection Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="e.g. Gothic Pillar"
            maxLength={120}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">
            Description <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <textarea
            value={collectionDescription}
            onChange={(e) => setCollectionDescription(e.target.value)}
            placeholder="Describe the collection…"
            rows={2}
            maxLength={1000}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add schematic files"
        className={[
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none',
          draggingOver
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-slate-600 hover:border-slate-500',
        ].join(' ')}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
        />
        <div className="text-slate-400 text-3xl mb-2">+</div>
        <p className="text-slate-300 font-medium">Add schematic files</p>
        <p className="text-slate-500 text-sm mt-1">Drop .xml files or click to browse — you can add multiple at once</p>
      </div>

      {/* Parts list */}
      {parts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-slate-300 font-medium text-sm">
            Parts — drag to reorder
          </h3>
          {parts.map((p, i) => (
            <div
              key={i}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex gap-4 items-start"
            >
              {/* Order indicator + move buttons */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                <span className="text-slate-500 text-xs font-mono w-5 text-center">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => i > 0 && movePart(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-sm leading-none"
                >▲</button>
                <button
                  type="button"
                  onClick={() => i < parts.length - 1 && movePart(i, i + 1)}
                  disabled={i === parts.length - 1}
                  aria-label="Move down"
                  className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-sm leading-none"
                >▼</button>
              </div>

              {/* Thumbnail preview */}
              <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {p.capturingThumb ? (
                  <span className="text-amber-400 animate-spin text-xl">⟳</span>
                ) : p.thumbnailBlob ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(p.thumbnailBlob)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-slate-600 text-2xl">📦</span>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-slate-500 text-xs truncate">{p.file.name}</p>
                <input
                  type="text"
                  value={p.displayName}
                  onChange={(e) => updatePart(i, 'displayName', e.target.value)}
                  placeholder="Display name"
                  maxLength={120}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
                <input
                  type="text"
                  value={p.description}
                  onChange={(e) => updatePart(i, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  maxLength={1000}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-400 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removePart(i)}
                aria-label="Remove this part"
                className="shrink-0 text-slate-500 hover:text-red-400 transition-colors text-lg leading-none mt-1"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={uploading || parts.length === 0}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
      >
        {uploading
          ? 'Uploading…'
          : `Upload Collection (${parts.length} part${parts.length !== 1 ? 's' : ''})`}
      </button>
    </form>
  );
}
