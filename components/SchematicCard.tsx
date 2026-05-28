import Link from 'next/link';
import ThumbnailImage from '@/components/ThumbnailImage';

interface Props {
  id: string;
  name: string;
  displayName: string | null;
  authorName?: string | null;
  uploadedAt: number;
  downloadCount?: number;
  likeCount?: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SchematicCard({
  id,
  name,
  displayName,
  authorName,
  uploadedAt,
  downloadCount = 0,
  likeCount = 0,
}: Props) {
  return (
    <Link href={`/view/${id}`} className="block group h-full">
      <div className="bg-slate-800 border border-slate-700 rounded-xl hover:border-amber-500/60 transition-colors duration-200 h-full flex flex-col overflow-hidden">
        {/* Thumbnail preview */}
        <div className="bg-slate-900 h-32 flex items-center justify-center">
          <ThumbnailImage id={id} alt={displayName || name} />
        </div>

        <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title */}
        <div>
          <h3 className="text-amber-400 font-semibold text-base truncate group-hover:text-amber-300 transition-colors">
            {displayName || name}
          </h3>
          {displayName && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{name}</p>
          )}
          {authorName && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">by {authorName}</p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between text-slate-500 text-xs">
          <div className="flex items-center gap-3">
            <span title="Likes">♥ {likeCount}</span>
            <span title="Downloads">⬇ {downloadCount}</span>
          </div>
          <span>{formatDate(uploadedAt)}</span>
        </div>
        </div>
      </div>
    </Link>
  );
}
