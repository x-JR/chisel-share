'use client';

import { useState, useRef, useCallback, useId } from 'react';
import { captureThumbnail } from '@/lib/capture-thumbnail-client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DesignEntry {
  id: string;
  /** Original design object from the Chisel Wiz JSON */
  jsonDesign: Record<string, unknown>;
  /** Human-readable name extracted from the design */
  name: string;
  /** Where this design came from */
  source: 'file' | 'site';
  /** Site schematic ID (only when source === 'site') */
  siteId?: number;
}

interface UploadSelection {
  selected: boolean;
  displayName: string;
  description: string;
}

interface SiteResult {
  id: number;
  display_name: string;
  thumbnail_path: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueId() {
  return Math.random().toString(36).slice(2);
}

/** Parse a Chisel Wiz catalogue JSON and return DesignEntry[] */
async function parseCatalogue(text: string): Promise<DesignEntry[]> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid Chisel Wiz catalogue');
  const designs = data.designs as Record<string, unknown>[] | undefined;
  if (!Array.isArray(designs) || designs.length === 0)
    throw new Error('No designs found in catalogue');

  return designs.map((d) => {
    const name =
      (d.name as string | undefined) ||
      ((d.blueprintData as Record<string, unknown> | undefined)?.name as string | undefined) ||
      'Unnamed';
    return { id: uniqueId(), jsonDesign: d, name, source: 'file' as const };
  });
}

/** Assemble a merged Chisel Wiz catalogue JSON string from entries */
function assembleCatalogue(entries: DesignEntry[]): string {
  return JSON.stringify({ version: 1, designs: entries.map((e) => e.jsonDesign) }, null, 2);
}

/** Trigger a JSON file download in the browser */
function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChiselWizMergeTool() {
  // Design list
  const [designs, setDesigns] = useState<DesignEntry[]>([]);

  // Upload-to-site selections (keyed by design.id, only for source='file' designs)
  const [selections, setSelections] = useState<Record<string, UploadSelection>>({});

  // Group as collection toggle
  const [groupAsCollection, setGroupAsCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');

  // Catalogue file drop zone
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Site browse
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SiteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload status
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedIds, setUploadedIds] = useState<number[]>([]);

  const uid = useId();

  // ── Catalogue file handling ──────────────────────────────────────────────

  const handleCatalogueFile = useCallback(async (f: File) => {
    setParseError(null);
    try {
      const text = await f.text();
      const entries = await parseCatalogue(text);
      setDesigns((prev) => {
        // Avoid adding duplicates from re-upload; merge by replacing all file-sourced entries
        const siteEntries = prev.filter((d) => d.source === 'site');
        return [...entries, ...siteEntries];
      });
      // Seed selections for new file designs
      setSelections((prev) => {
        const next = { ...prev };
        for (const d of entries) {
          if (!next[d.id]) {
            next[d.id] = { selected: false, displayName: d.name, description: '' };
          }
        }
        return next;
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleCatalogueFile(f);
  }

  // ── Design list operations ───────────────────────────────────────────────

  function removeDesign(id: string) {
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    setSelections((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function moveDesign(from: number, to: number) {
    setDesigns((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // ── Site browsing ────────────────────────────────────────────────────────

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ search: q, per_page: '8', sort: 'newest' });
        const res = await fetch(`/api/schematics?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSearchResults(data.schematics ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function addFromSite(result: SiteResult) {
    // Prevent duplicates
    if (designs.some((d) => d.source === 'site' && d.siteId === result.id)) return;

    try {
      const res = await fetch(`/api/schematics/${result.id}/download?format=chiselwiz`);
      if (!res.ok) throw new Error('Failed to fetch schematic');
      const json = await res.json();
      const design = json?.designs?.[0];
      if (!design) throw new Error('Invalid response');

      const entry: DesignEntry = {
        id: uniqueId(),
        jsonDesign: design,
        name: result.display_name,
        source: 'site',
        siteId: result.id,
      };
      setDesigns((prev) => [...prev, entry]);
    } catch {
      // Silently ignore — the button will remain enabled so user can retry
    }
  }

  // ── Selection management ─────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id]?.selected },
    }));
  }

  function updateSelection(id: string, field: 'displayName' | 'description', value: string) {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  // ── Download merged catalogue ────────────────────────────────────────────

  function downloadMerged() {
    if (!designs.length) return;
    downloadJson('chiselwiz-catalogue.json', assembleCatalogue(designs));
  }

  // ── Upload to site ───────────────────────────────────────────────────────

  const selectedFileDesigns = designs.filter(
    (d) => d.source === 'file' && selections[d.id]?.selected
  );

  async function handleUpload() {
    if (!selectedFileDesigns.length) return;

    if (groupAsCollection && !collectionName.trim()) {
      setUploadError('Collection name is required');
      return;
    }

    setUploadStatus('uploading');
    setUploadError(null);
    setUploadedIds([]);
    setUploadProgress(0);
    setUploadTotal(selectedFileDesigns.length);

    try {
      if (groupAsCollection) {
        await uploadAsCollection();
      } else {
        await uploadStandalone();
      }
      setUploadStatus('done');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setUploadStatus('error');
    }
  }

  async function uploadStandalone() {
    const ids: number[] = [];
    for (let i = 0; i < selectedFileDesigns.length; i++) {
      const d = selectedFileDesigns[i];
      const sel = selections[d.id];
      const jsonText = JSON.stringify({ version: 1, designs: [d.jsonDesign] });

      // Generate thumbnail
      const thumbBlob = await captureThumbnail(jsonText).catch(() => null);

      const formData = new FormData();
      formData.append('file', new Blob([jsonText], { type: 'application/json' }), `${d.id}.json`);
      formData.append('display_name', sel.displayName.trim() || d.name);
      if (sel.description.trim()) formData.append('description', sel.description.trim());
      if (thumbBlob) formData.append('thumbnail', thumbBlob, 'thumbnail.png');

      const res = await fetch('/api/schematics', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error ?? 'Upload failed');
      }
      const data = await res.json();
      ids.push(data.id);
      setUploadProgress(i + 1);
    }
    setUploadedIds(ids);
  }

  async function uploadAsCollection() {
    const formData = new FormData();
    formData.append('name', collectionName.trim());
    if (collectionDescription.trim())
      formData.append('description', collectionDescription.trim());
    formData.append('count', String(selectedFileDesigns.length));

    for (let i = 0; i < selectedFileDesigns.length; i++) {
      const d = selectedFileDesigns[i];
      const sel = selections[d.id];
      const jsonText = JSON.stringify({ version: 1, designs: [d.jsonDesign] });
      const thumbBlob = await captureThumbnail(jsonText).catch(() => null);

      formData.append(`file_${i}`, new Blob([jsonText], { type: 'application/json' }), `${d.id}.json`);
      formData.append(`display_name_${i}`, sel.displayName.trim() || d.name);
      if (sel.description.trim()) formData.append(`description_${i}`, sel.description.trim());
      if (thumbBlob) formData.append(`thumbnail_${i}`, thumbBlob, 'thumbnail.png');

      setUploadProgress(i + 1);
    }

    formData.append('image_count', '0');
    formData.append('thumbnail_image_index', '0');

    const res = await fetch('/api/collections', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(data.error ?? 'Upload failed');
    }
    const data = await res.json();
    setUploadedIds([data.id]);
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const fileDesigns = designs.filter((d) => d.source === 'file');
  const siteDesigns = designs.filter((d) => d.source === 'site');
  const hasDesigns = designs.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Section 1: Upload catalogue ─────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-slate-200 font-semibold text-lg mb-4">
          1. Upload your Chisel Wiz catalogue
        </h2>
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop Chisel Wiz catalogue JSON file"
          className={[
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none',
            dragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600 hover:border-slate-500',
            fileDesigns.length > 0 ? '!border-green-600 !bg-green-600/10' : '',
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
            accept=".json"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleCatalogueFile(e.target.files[0]); }}
          />
          {fileDesigns.length > 0 ? (
            <div>
              <div className="text-green-400 text-3xl mb-2">✓</div>
              <p className="text-green-400 font-medium">
                {fileDesigns.length} design{fileDesigns.length !== 1 ? 's' : ''} loaded
              </p>
              <p className="text-slate-500 text-sm mt-1">Click to replace with a different catalogue</p>
            </div>
          ) : (
            <div>
              <div className="text-slate-400 text-4xl mb-3">📂</div>
              <p className="text-slate-300 font-medium">Drop your Chisel Wiz catalogue here</p>
              <p className="text-slate-500 text-sm mt-1">or click to browse &mdash; .json files only</p>
            </div>
          )}
        </div>
        {parseError && (
          <div className="mt-3 bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {parseError}
          </div>
        )}
        <p className="mt-3 text-slate-500 text-xs">
          Your Chisel Wiz catalogue is read entirely in your browser — it is not sent to the server
          unless you choose to share designs below.
        </p>
      </section>

      {/* ── Section 2: Browse & add from site ───────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-slate-200 font-semibold text-lg mb-4">
          2. Add designs from the gallery
        </h2>
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search schematics by name…"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm animate-pulse">
              Searching…
            </span>
          )}
        </div>

        {searchResults.length > 0 && (
          <ul className="mt-3 space-y-2">
            {searchResults.map((r) => {
              const alreadyAdded = designs.some(
                (d) => d.source === 'site' && d.siteId === r.id
              );
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2"
                >
                  {r.thumbnail_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/schematics/${r.id}/thumbnail`}
                      alt=""
                      className="w-10 h-10 rounded object-cover bg-slate-700 flex-shrink-0"
                    />
                  )}
                  <span className="text-slate-200 text-sm flex-1 truncate">{r.display_name}</span>
                  <button
                    type="button"
                    onClick={() => addFromSite(r)}
                    disabled={alreadyAdded}
                    className="text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:text-slate-500 disabled:cursor-default bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 text-white"
                  >
                    {alreadyAdded ? 'Added' : '+ Add'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {searchQuery && !searching && searchResults.length === 0 && (
          <p className="mt-3 text-slate-500 text-sm">No results found.</p>
        )}

        {siteDesigns.length > 0 && (
          <p className="mt-3 text-slate-500 text-xs">
            {siteDesigns.length} site design{siteDesigns.length !== 1 ? 's' : ''} added to your catalogue.
          </p>
        )}
      </section>

      {/* ── Section 3: Merged list + download ───────────────────────────── */}
      {hasDesigns && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-200 font-semibold text-lg">
              3. Merged catalogue ({designs.length} design{designs.length !== 1 ? 's' : ''})
            </h2>
            <button
              type="button"
              onClick={downloadMerged}
              className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              ⬇ Download catalogue
            </button>
          </div>

          <ul className="space-y-2">
            {designs.map((d, i) => (
              <li
                key={d.id}
                className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2"
              >
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveDesign(i, i - 1)}
                    aria-label="Move up"
                    className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === designs.length - 1}
                    onClick={() => moveDesign(i, i + 1)}
                    aria-label="Move down"
                    className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>

                <span className="text-slate-200 text-sm flex-1 truncate">{d.name}</span>

                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                    d.source === 'site'
                      ? 'bg-sky-900 text-sky-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {d.source === 'site' ? 'From site' : 'Your file'}
                </span>

                <button
                  type="button"
                  onClick={() => removeDesign(d.id)}
                  aria-label={`Remove ${d.name}`}
                  className="text-slate-500 hover:text-red-400 transition-colors text-sm flex-shrink-0"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 4: Community upload ─────────────────────────────────── */}
      {fileDesigns.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold text-lg mb-1">
            4. Share with the community
          </h2>
          <p className="text-slate-500 text-sm mb-5">
            Select designs from your catalogue to upload publicly. Site designs are already shared.
          </p>

          <div className="space-y-3">
            {fileDesigns.map((d) => {
              const sel = selections[d.id] ?? { selected: false, displayName: d.name, description: '' };
              const checkId = `${uid}-check-${d.id}`;
              return (
                <div
                  key={d.id}
                  className={`border rounded-lg transition-colors ${
                    sel.selected
                      ? 'border-amber-600 bg-amber-950/30'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  {/* Header row */}
                  <label
                    htmlFor={checkId}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  >
                    <input
                      id={checkId}
                      type="checkbox"
                      checked={sel.selected}
                      onChange={() => toggleSelect(d.id)}
                      className="accent-amber-500 w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-slate-200 text-sm font-medium truncate flex-1">
                      {d.name}
                    </span>
                  </label>

                  {/* Expanded fields when selected */}
                  {sel.selected && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
                      <div>
                        <label className="block text-slate-400 text-xs font-medium mb-1">
                          Display name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={sel.displayName}
                          onChange={(e) => updateSelection(d.id, 'displayName', e.target.value)}
                          maxLength={100}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-medium mb-1">
                          Description <span className="text-slate-500 font-normal">(optional)</span>
                        </label>
                        <textarea
                          value={sel.description}
                          onChange={(e) => updateSelection(d.id, 'description', e.target.value)}
                          maxLength={500}
                          rows={2}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Group as Collection toggle */}
          {selectedFileDesigns.length > 1 && (
            <div className="mt-5 border border-slate-700 rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupAsCollection}
                  onChange={(e) => setGroupAsCollection(e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
                <span className="text-slate-200 text-sm font-medium">
                  Upload selected designs as a Collection
                </span>
              </label>

              {groupAsCollection && (
                <div className="space-y-3 pl-7">
                  <div>
                    <label className="block text-slate-400 text-xs font-medium mb-1">
                      Collection name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      maxLength={100}
                      placeholder="e.g. Granite Pillar Set"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs font-medium mb-1">
                      Collection description <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={collectionDescription}
                      onChange={(e) => setCollectionDescription(e.target.value)}
                      maxLength={500}
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload progress / status */}
          {uploadStatus === 'uploading' && (
            <div className="mt-5">
              <div className="flex justify-between text-slate-400 text-xs mb-1">
                <span>Uploading…</span>
                <span>{uploadProgress}/{uploadTotal}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadTotal > 0 ? (uploadProgress / uploadTotal) * 100 : 0}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Generating thumbnails and uploading — this may take a moment.
              </p>
            </div>
          )}

          {uploadStatus === 'done' && (
            <div className="mt-5 bg-green-950 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">
              {groupAsCollection ? (
                <>
                  Collection uploaded!{' '}
                  <a
                    href={`/view/collection/${uploadedIds[0]}`}
                    className="underline hover:text-green-200"
                  >
                    View collection →
                  </a>
                </>
              ) : (
                <>
                  {uploadedIds.length} schematic{uploadedIds.length !== 1 ? 's' : ''} uploaded!{' '}
                  {uploadedIds.length === 1 && (
                    <a
                      href={`/view/${uploadedIds[0]}`}
                      className="underline hover:text-green-200"
                    >
                      View it →
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {uploadError && (
            <div className="mt-5 bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
              {uploadError}
            </div>
          )}

          {/* Upload button */}
          {uploadStatus !== 'done' && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={
                selectedFileDesigns.length === 0 ||
                uploadStatus === 'uploading' ||
                (groupAsCollection && !collectionName.trim())
              }
              className="mt-5 w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {uploadStatus === 'uploading'
                ? 'Uploading…'
                : selectedFileDesigns.length === 0
                ? 'Select at least one design above'
                : groupAsCollection
                ? `Upload ${selectedFileDesigns.length} design${selectedFileDesigns.length !== 1 ? 's' : ''} as collection`
                : `Upload ${selectedFileDesigns.length} design${selectedFileDesigns.length !== 1 ? 's' : ''} to site`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
