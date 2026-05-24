'use client';

import { useState, useEffect } from 'react';

interface Props {
  apiPath: string; // e.g. /api/schematics/{id}/like  or  /api/collections/{id}/like
  initialCount: number;
}

export default function LikeButton({ apiPath, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch(apiPath)
      .then((r) => r.json())
      .then((data) => {
        setLiked(data.liked);
        setCount(data.count);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [apiPath]);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    // Optimistic update
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(apiPath, { method: 'POST' });
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      // Roll back optimistic update on failure
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || !ready}
      aria-label={liked ? 'Unlike this schematic' : 'Like this schematic'}
      className={[
        'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border font-medium transition-colors',
        liked
          ? 'bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900/50'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300',
        !ready ? 'opacity-50 cursor-default' : '',
      ].join(' ')}
    >
      <span className="text-base leading-none">{liked ? '♥' : '♡'}</span>
      <span>{count} {count === 1 ? 'like' : 'likes'}</span>
    </button>
  );
}
