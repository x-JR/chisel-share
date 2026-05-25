'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { captureThumbnail } from '@/lib/capture-thumbnail-client';
import LikeButton from './LikeButton';
import DownloadButton from './DownloadButton';
import DeleteCollectionButton from './DeleteCollectionButton';
import SchematicCard from './SchematicCard';
import RegenerateThumbnailButton from './RegenerateThumbnailButton';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectionData {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
}

export interface SchematicData {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  uploaded_at: number;
  download_count: number;
  like_count: number;
}

interface ExistingPart {
  kind: 'existing';
  id: string;
  displayName: string;
  description: string;
}

interface NewPart {
  kind: 'new';
  key: string;
  file: File;
  displayName: string;
  description: string;
  thumbnailBlob: Blob | null;
  capturingThumb: boolean;
}

type EditPart = ExistingPart | NewPart;

interface Props {
  collection: CollectionData;
  schematics: SchematicData[];
  likeCount: number;
  canEdit: boolean;
  isAdmin: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditCollectionClient({
  collection,
  schematics,
  likeCount,
  canEdit,
  isAdmin,
}: Props) {
  const router = useRouter();

  // ── Edit state ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [collectionName, setCollectionName] = useState(collection.name);
  const [collectionDescription, setCollectionDescription] = useState(
    collection.description ?? ''
  );
  const [parts, setParts] = useState<EditPart[]>(() =>
    schematics.map((s) => ({
      kind: 'existing' as const,
      id: s.id,
      displayName: s.display_name ?? s.name,
      description: s.description ?? '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Part helpers ─────────────────────────────────────────────────────────

  function movePart(from: number, to: number) {
    setParts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePart(index: number, field: 'displayName' | 'description', value: string) {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    const baseKey = Date.now();
    const seedParts: NewPart[] = incoming.map((f, i) => ({
      kind: 'new' as const,
      key: `${baseKey}-${i}`,
      file: f,
      displayName: f.name.replace(/\.[^.]+$/, ''),
      description: '',
      thumbnailBlob: null,
      capturingThumb: true,
    }));

    setParts((prev) => [...prev, ...seedParts]);

    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i];
      const targetKey = seedParts[i].key;
      try {
        const text = await f.text();
        const nameMatch = text.match(/<name[^>]*>(.*?)<\/name>/i);
        const xmlName = nameMatch?.[1]?.trim();
        const blob = await captureThumbnail(text).catch(() => null);
        setParts((prev) =>
          prev.map((p) =>
            p.kind === 'new' && p.key === targetKey
              ? { ...p, displayName: xmlName || p.displayName, thumbnailBlob: blob, capturingThumb: false }
              : p
          )
        );
      } catch {
        setParts((prev) =>
          prev.map((p) =>
            p.kind === 'new' && p.key === targetKey ? { ...p, capturingThumb: false } : p
          )
        );
      }
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!collectionName.trim()) {
      setError('Collection name is required');
      return;
    }
    if (parts.length === 0) {
      setError('Collection must have at least one part');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', collectionName.trim());
      if (collectionDescription.trim())
        fd.append('description', collectionDescription.trim());

      const existingOrder = parts
        .filter((p): p is ExistingPart => p.kind === 'existing')
        .map((p) => p.id);
      fd.append('order', JSON.stringify(existingOrder));

      for (const p of parts) {
        if (p.kind === 'existing') {
          fd.append(`meta_${p.id}_display_name`, p.displayName);
          fd.append(`meta_${p.id}_description`, p.description);
        }
      }

      const newParts = parts.filter((p): p is NewPart => p.kind === 'new');
      fd.append('new_count', String(newParts.length));
      newParts.forEach((p, i) => {
        fd.append(`new_file_${i}`, p.file);
        fd.append(`new_display_name_${i}`, p.displayName.trim() || p.file.name);
        if (p.description.trim()) fd.append(`new_description_${i}`, p.description.trim());
        if (p.thumbnailBlob) fd.append(`new_thumbnail_${i}`, p.thumbnailBlob, 'thumbnail.png');
      });

      const res = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Save failed');
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setCollectionName(collection.name);
    setCollectionDescription(collection.description ?? '');
    setParts(
      schematics.map((s) => ({
        kind: 'existing' as const,
        id: s.id,
        displayName: s.display_name ?? s.name,
        description: s.description ?? '',
      }))
    );
    setEditing(false);
    setError(null);
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <>
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-amber-400 break-words">{collection.name}</h1>
              <span className="text-xs bg-amber-700/40 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full font-medium">
                Collection · {schematics.length} {schematics.length === 1 ? 'part' : 'parts'}
              </span>
            </div>
            {collection.description && (
              <p className="text-slate-300 text-sm mt-3 leading-relaxed max-w-2xl">
                {collection.description}
              </p>
            )}
            <p className="text-slate-500 text-sm mt-2">
              Uploaded{' '}
              {new Date(collection.created_at * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {canEdit ? (
            <div className="shrink-0 grid grid-cols-2 gap-2 w-96">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border font-medium text-sm transition-colors bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
              >
                ✏ Edit Collection
              </button>
              <DownloadButton
                href={`/api/collections/${collection.id}/download`}
                filename={`${collection.name.replace(/[^a-zA-Z0-9 _-]/g, '_')}.zip`}
                label="⬇ Download All"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
              />
              <DeleteCollectionButton id={collection.id} />
              <LikeButton apiPath={`/api/collections/${collection.id}/like`} initialCount={likeCount} />
            </div>
          ) : (
            <div className="shrink-0 flex flex-col gap-2 w-48">
              <DownloadButton
                href={`/api/collections/${collection.id}/download`}
                filename={`${collection.name.replace(/[^a-zA-Z0-9 _-]/g, '_')}.zip`}
                label="⬇ Download All"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
              />
              <LikeButton apiPath={`/api/collections/${collection.id}/like`} initialCount={likeCount} />
            </div>
          )}
        </div>

        {/* Parts grid */}
        {schematics.length === 0 ? (
          <p className="text-slate-500 text-center py-16">No schematics in this collection.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {schematics.map((s, i) => (
              <div key={s.id} className="relative">
                <span className="absolute top-2 left-2 z-10 bg-slate-900/80 text-slate-400 text-xs font-mono px-2 py-0.5 rounded-full border border-slate-700">
                  Part {i + 1}
                </span>
                <SchematicCard
                  id={s.id}
                  name={s.name}
                  displayName={s.display_name}
                  uploadedAt={s.uploaded_at}
                  downloadCount={s.download_count}
                  likeCount={s.like_count}
                />
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Edit header */}
      <div className="bg-slate-900 border border-amber-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-400">Edit Collection</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">
              Collection Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              maxLength={120}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">
              Description
            </label>
            <textarea
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Describe the collection…"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Parts editor */}
      <div className="space-y-3">
        <h3 className="text-slate-300 font-medium text-sm">
          Parts ({parts.length}) — reorder with ▲/▼, remove with ×
        </h3>
        {parts.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4 border border-dashed border-slate-700 rounded-xl">
            All parts removed. Add at least one schematic below.
          </p>
        )}
        {parts.map((p, i) => (
          <div
            key={p.kind === 'existing' ? p.id : p.key}
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

            {/* Thumbnail */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden">
                {p.kind === 'existing' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/schematics/${p.id}/thumb`}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : p.capturingThumb ? (
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
              {isAdmin && p.kind === 'existing' && (
                <RegenerateThumbnailButton id={p.id} />
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 min-w-0 space-y-2">
              {p.kind === 'new' && (
                <p className="text-slate-500 text-xs truncate">{p.file.name}</p>
              )}
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
              className="shrink-0 text-slate-500 hover:text-red-400 transition-colors text-xl leading-none mt-1"
            >×</button>
          </div>
        ))}
      </div>

      {/* Add new schematics */}
      <div>
        <h3 className="text-slate-300 font-medium text-sm mb-2">Add more schematics</h3>
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
            accept=".xml"
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
          />
          <div className="text-slate-400 text-3xl mb-2">+</div>
          <p className="text-slate-300 font-medium">Add schematic files</p>
          <p className="text-slate-500 text-sm mt-1">Drop .xml files or click to browse</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Bottom save/cancel */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : `Save Changes (${parts.length} part${parts.length !== 1 ? 's' : ''})`}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-semibold py-3 rounded-lg border border-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
