'use client';

import Link from 'next/link';
import ThumbnailImage from './ThumbnailImage';
import { formatDate, formatCompactCount } from '@/lib/format';

interface Props {
  id: string;
  name: string;
  description: string | null;
  authorName?: string | null;
  createdAt: number;
  memberCount: number;
  firstSchematicId: string | null;
  likeCount?: number;
  thumbnailImageId?: string | null;
}

export default function CollectionCard({
  id,
  name,
  description,
  authorName,
  createdAt,
  memberCount,
  firstSchematicId,
  likeCount = 0,
  thumbnailImageId,
}: Props) {
  return (
    <Link href={`/view/collection/${id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-lg hover:shadow-black/30">
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="absolute inset-0 flex items-center justify-center p-2 transition-transform duration-300 group-hover:scale-[1.04]">
            {thumbnailImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/collections/${id}/images/${thumbnailImageId}`}
                alt={name}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : firstSchematicId ? (
              <ThumbnailImage id={firstSchematicId} alt={name} />
            ) : (
              <span className="text-4xl text-slate-700">📦</span>
            )}
          </div>
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-amber-700/50 bg-slate-950/80 px-2 py-0.5 text-xs font-semibold text-amber-300 backdrop-blur-sm">
            📦 {memberCount} {memberCount === 1 ? 'part' : 'parts'}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-amber-400 transition-colors group-hover:text-amber-300">
                {name}
              </h3>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Collection</span>
          </div>

          {description && (
            <p className="line-clamp-2 text-sm text-slate-400">{description}</p>
          )}
          {authorName && (
            <p className="truncate text-xs text-slate-500">
              by <span className="text-slate-400">{authorName}</span>
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1" title={`${likeCount} likes`}>
              <span className="text-amber-500/80">♥</span> {formatCompactCount(likeCount)}
            </span>
            <span className="whitespace-nowrap">{formatDate(createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
