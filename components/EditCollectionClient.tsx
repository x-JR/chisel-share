'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { captureThumbnail } from '@/lib/capture-thumbnail-client';
import LikeButton from './LikeButton';
import DownloadButton from './DownloadButton';
import DeleteCollectionButton from './DeleteCollectionButton';
import SchematicCard from './SchematicCard';
import RegenerateThumbnailButton from './RegenerateThumbnailButton';
import ReportButton from './ReportButton';

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

export interface CollectionImageData {
  id: string;
  display_order: number;
  ext: string;
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

interface ExistingImage {
  kind: 'existing';
  id: string;
  ext: string;
  display_order: number;
  isThumb: boolean;
}

interface NewImage {
  kind: 'new';
  key: string;
  file: File;
  previewUrl: string;
  isThumb: boolean;
}

type EditImage = ExistingImage | NewImage;

interface Props {
  collection: CollectionData;
  schematics: SchematicData[];
  images: CollectionImageData[];
  likeCount: number;
  canEdit: boolean;
  isAdmin: boolean;
  reportCount?: number;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditCollectionClient({
  collection,
  schematics,
  images: initialImages,
  likeCount,
  canEdit,
  isAdmin,
  reportCount,
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
  const [editImages, setEditImages] = useState<EditImage[]>(() =>
    initialImages
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((img, idx) => ({
        kind: 'existing' as const,
        id: img.id,
        ext: img.ext,
        display_order: img.display_order,
        isThumb: idx === 0,
      }))
  );
  const [imageEditError, setImageEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageEditInputRef = useRef<HTMLInputElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

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

  // ── Image helpers ─────────────────────────────────────────────────────────

  function addEditImageFiles(files: FileList | File[]) {
    setImageEditError(null);
    const incoming = Array.from(files).filter((f) => f.type === 'image/jpeg' || f.type === 'image/png');
    if (!incoming.length) {
      setImageEditError('Only JPEG and PNG images are accepted');
      return;
    }
    setEditImages((prev) => {
      const slots = MAX_IMAGES - prev.length;
      if (slots <= 0) return prev;
      const toAdd: NewImage[] = incoming.slice(0, slots).map((f, i) => ({
        kind: 'new' as const,
        key: `${Date.now()}-${i}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        isThumb: false,
      }));
      const combined = [...prev, ...toAdd];
      if (!combined.some((img) => img.isThumb) && combined.length > 0) {
        combined[0] = { ...combined[0], isThumb: true };
      }
      return combined;
    });
  }

  function removeEditImage(index: number) {
    setEditImages((prev) => {
      const wasThumb = prev[index].isThumb;
      const next = prev.filter((_, i) => i !== index);
      if (wasThumb && next.length > 0) next[0] = { ...next[0], isThumb: true };
      return next;
    });
  }

  function setEditImageThumb(index: number) {
    setEditImages((prev) => prev.map((img, i) => ({ ...img, isThumb: i === index })));
  }

  function moveEditImage(from: number, to: number) {
    setEditImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Keep thumbnail assignment stable
      return next;
    });
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

      // Image management
      const removedImageIds = initialImages
        .map((img) => img.id)
        .filter((imgId) => !editImages.some((ei) => ei.kind === 'existing' && ei.id === imgId));
      fd.append('img_remove', JSON.stringify(removedImageIds));

      const existingImgOrder = editImages
        .filter((img): img is ExistingImage => img.kind === 'existing')
        .map((img) => img.id);
      fd.append('img_order', JSON.stringify(existingImgOrder));

      const newImages = editImages.filter((img): img is NewImage => img.kind === 'new');
      fd.append('img_new_count', String(newImages.length));
      newImages.forEach((img, i) => fd.append(`img_new_${i}`, img.file));

      const thumbImage = editImages.find((img) => img.isThumb);
      if (thumbImage?.kind === 'existing') {
        fd.append('thumbnail_image_id', thumbImage.id);
      } else if (thumbImage?.kind === 'new') {
        // New thumbnail image; server will assign ID — fall back to first image via empty string
        // The server will default to the first valid image if thumbnail_image_id is absent
        fd.append('thumbnail_image_id', '');
      } else if (editImages.length === 0) {
        fd.append('thumbnail_image_id', '');
      }

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
    setEditImages(
      initialImages
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((img, idx) => ({
          kind: 'existing' as const,
          id: img.id,
          ext: img.ext,
          display_order: img.display_order,
          isThumb: idx === 0,
        }))
    );
    setEditing(false);
    setError(null);
    setImageEditError(null);
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <>
        {/* Custom image carousel */}
        {initialImages.length > 0 && (
          <div className="mb-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/collections/${collection.id}/images/${initialImages[carouselIndex]?.id}`}
                alt={`Collection image ${carouselIndex + 1}`}
                className="w-full object-contain max-h-96 bg-slate-950"
              />
              {initialImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCarouselIndex((i) => (i - 1 + initialImages.length) % initialImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                    aria-label="Previous image"
                  >‹</button>
                  <button
                    onClick={() => setCarouselIndex((i) => (i + 1) % initialImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                    aria-label="Next image"
                  >›</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {initialImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCarouselIndex(idx)}
                        className={[
                          'w-2 h-2 rounded-full transition-colors',
                          idx === carouselIndex ? 'bg-amber-400' : 'bg-slate-600 hover:bg-slate-400',
                        ].join(' ')}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-amber-400 break-words">{collection.name}</h1>
              <span className="text-xs bg-amber-700/40 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full font-medium">
                Collection · {schematics.length} {schematics.length === 1 ? 'part' : 'parts'}
              </span>
              {isAdmin && typeof reportCount === 'number' && reportCount > 0 && (
                <span className="text-xs bg-red-900/40 text-red-300 border border-red-700/60 px-2 py-0.5 rounded-full font-medium">
                  ⚑ {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                </span>
              )}
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
            <div className="shrink-0 grid grid-cols-2 gap-2 w-48">
              <DownloadButton
                href={`/api/collections/${collection.id}/download`}
                filename={`${collection.name.replace(/[^a-zA-Z0-9 _-]/g, '_')}.zip`}
                label="⬇ Download All"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
              />
              <LikeButton apiPath={`/api/collections/${collection.id}/like`} initialCount={likeCount} />
              <div className="col-span-2">
                <ReportButton collectionId={collection.id} />
              </div>
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

      {/* Image management */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-300 font-medium text-sm">
            Collection Images{' '}
            <span className="text-slate-500 font-normal">(optional, up to {MAX_IMAGES})</span>
          </h3>
          <span className="text-slate-500 text-xs">{editImages.length} / {MAX_IMAGES}</span>
        </div>
        <p className="text-slate-500 text-xs">
          Photos showing how the schematics fit together. The starred image is used as the gallery card thumbnail.
        </p>

        {editImages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {editImages.map((img, i) => (
              <div key={img.kind === 'existing' ? img.id : img.key} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    img.kind === 'existing'
                      ? `/api/collections/${collection.id}/images/${img.id}`
                      : img.previewUrl
                  }
                  alt={`Image ${i + 1}`}
                  className={[
                    'w-full aspect-square object-cover rounded-lg border-2 transition-colors',
                    img.isThumb ? 'border-amber-500' : 'border-slate-700',
                  ].join(' ')}
                />
                <div className="absolute inset-0 flex flex-col items-end justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <button
                    type="button"
                    onClick={() => removeEditImage(i)}
                    aria-label="Remove image"
                    className="pointer-events-auto bg-red-700 hover:bg-red-600 text-white text-xs w-6 h-6 flex items-center justify-center rounded transition-colors"
                  >×</button>
                  <div className="flex gap-1 pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => i > 0 && moveEditImage(i, i - 1)}
                      disabled={i === 0}
                      aria-label="Move left"
                      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-20 text-white text-xs w-6 h-6 flex items-center justify-center rounded transition-colors"
                    >◀</button>
                    <button
                      type="button"
                      onClick={() => i < editImages.length - 1 && moveEditImage(i, i + 1)}
                      disabled={i === editImages.length - 1}
                      aria-label="Move right"
                      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-20 text-white text-xs w-6 h-6 flex items-center justify-center rounded transition-colors"
                    >▶</button>
                  </div>
                </div>
                {img.isThumb ? (
                  <span className="absolute top-1 left-1 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                    ★
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditImageThumb(i)}
                    title="Set as gallery thumbnail"
                    className="absolute top-1 left-1 bg-slate-800/80 hover:bg-amber-700 text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ☆
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {editImages.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => imageEditInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl py-3 text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            + Add images (JPEG/PNG, max 5 MB each)
          </button>
        )}
        <input
          ref={imageEditInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => { if (e.target.files) addEditImageFiles(e.target.files); e.target.value = ''; }}
        />
        {imageEditError && (
          <p className="text-amber-400 text-xs">{imageEditError}</p>
        )}
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
