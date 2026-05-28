'use client';

import { useState } from 'react';
import LikeButton from './LikeButton';
import DownloadButton from './DownloadButton';
import DeleteButton from './DeleteButton';

interface Props {
  id: string;
  initialDisplayName: string;
  initialDescription: string | null;
  initialAuthorName: string | null;
  schematicName: string;
  cuboidCount: number;
  downloadCount: number;
  likeCount: number;
  uploadedAt: number;
  canEdit: boolean;
}

export default function EditSchematicClient({
  id,
  initialDisplayName,
  initialDescription,
  initialAuthorName,
  schematicName,
  cuboidCount,
  downloadCount,
  likeCount,
  uploadedAt,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [authorName, setAuthorName] = useState(initialAuthorName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/schematics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          description: description.trim() || null,
          author_name: authorName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Save failed');
      }
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDisplayName(initialDisplayName);
    setDescription(initialDescription ?? '');
    setAuthorName(initialAuthorName ?? '');
    setEditing(false);
    setError(null);
  }

  const title = displayName || schematicName;

  return (
    <>
      {/* Title card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">
                Display Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                autoFocus
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Describe your schematic…"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">
                Author
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={100}
                placeholder="Your name or alias"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-3 py-1.5">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium py-2 rounded-lg border border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold text-amber-400 break-words">{title}</h1>
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="shrink-0 text-slate-500 hover:text-slate-300 text-xs border border-slate-700 hover:border-slate-500 rounded px-2 py-1 transition-colors"
                >
                  ✏ Edit
                </button>
              )}
            </div>
            {displayName && displayName !== schematicName && (
              <p className="text-slate-500 text-sm mt-1 break-words">{schematicName}</p>
            )}
            {authorName && (
              <p className="text-slate-400 text-sm mt-1">by {authorName}</p>
            )}
            {description && (
              <p className="text-slate-300 text-sm mt-3 leading-relaxed">{description}</p>
            )}
            <div className="mt-4 pt-4 border-t border-slate-800 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Cuboids</span>
                <span className="text-slate-200">{cuboidCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Downloads</span>
                <span className="text-slate-200">{downloadCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Likes</span>
                <span className="text-slate-200">{likeCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Uploaded</span>
                <span className="text-slate-200">
                  {new Date(uploadedAt * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2.5">
        <DownloadButton
          href={`/api/schematics/${id}/download`}
          filename={`${title.replace(/[^a-zA-Z0-9 _-]/g, '_')}.xml`}
          label="⬇ Download (QP Chisel .xml)"
        />
        <DownloadButton
          href={`/api/schematics/${id}/download?format=chiselwiz`}
          filename="chiselwiz-catalogue.json"
          label="⬇ Download (Chisel Wiz .json)"
          className="block w-full text-center bg-slate-700 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
        />
        <LikeButton apiPath={`/api/schematics/${id}/like`} initialCount={likeCount} />
        {canEdit && <DeleteButton id={id} />}
      </div>
    </>
  );
}
