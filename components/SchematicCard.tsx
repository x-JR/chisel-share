import Link from 'next/link';
import ThumbnailImage from '@/components/ThumbnailImage';
import { formatDate, formatCompactCount } from '@/lib/format';

interface Props {
  id: string;
  name: string;
  displayName: string | null;
  description?: string | null;
  authorName?: string | null;
  uploadedAt: number;
  downloadCount?: number;
  likeCount?: number;
}

export default function SchematicCard({
  id,
  name,
  displayName,
  description,
  authorName,
  uploadedAt,
  downloadCount = 0,
  likeCount = 0,
}: Props) {
  const title = displayName || name;
  return (
    <Link href={`/view/${id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-lg hover:shadow-black/30">
        {/* Thumbnail preview */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="absolute inset-0 flex items-center justify-center p-2 transition-transform duration-300 group-hover:scale-[1.04]">
            <ThumbnailImage id={id} alt={title} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          {/* Title */}
          <div>
            <h3 className="truncate text-base font-semibold text-amber-400 transition-colors group-hover:text-amber-300">
              {title}
            </h3>
            {displayName && displayName !== name && (
              <p className="mt-0.5 truncate font-mono text-xs text-slate-600">{name}</p>
            )}
          </div>

          {description && (
            <p className="line-clamp-2 text-sm text-slate-400">{description}</p>
          )}

          {authorName && (
            <p className="truncate text-xs text-slate-500">
              by <span className="text-slate-400">{authorName}</span>
            </p>
          )}

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1" title={`${likeCount} likes`}>
                <span className="text-amber-500/80">♥</span> {formatCompactCount(likeCount)}
              </span>
              <span className="flex items-center gap-1" title={`${downloadCount} downloads`}>
                <span className="text-slate-500">⬇</span> {formatCompactCount(downloadCount)}
              </span>
            </div>
            <span className="whitespace-nowrap">{formatDate(uploadedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
