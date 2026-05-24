import Link from 'next/link';
import ThumbnailImage from './ThumbnailImage';

interface Props {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  memberCount: number;
  firstSchematicId: string | null;
  likeCount?: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CollectionCard({
  id,
  name,
  description,
  createdAt,
  memberCount,
  firstSchematicId,
  likeCount = 0,
}: Props) {
  return (
    <Link href={`/view/collection/${id}`} className="block group h-full">
      <div className="bg-slate-800 border border-slate-700 rounded-xl hover:border-amber-500/60 transition-colors duration-200 h-full flex flex-col overflow-hidden">
        {/* Thumbnail */}
        <div className="bg-slate-900 h-32 flex items-center justify-center relative">
          {firstSchematicId ? (
            <ThumbnailImage id={firstSchematicId} alt={name} />
          ) : (
            <span className="text-slate-600 text-4xl">📦</span>
          )}
          <span className="absolute top-2 right-2 bg-amber-700 text-amber-100 text-xs font-bold px-2 py-0.5 rounded-full">
            {memberCount} {memberCount === 1 ? 'part' : 'parts'}
          </span>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          <div>
            <h3 className="text-amber-400 font-semibold text-base truncate group-hover:text-amber-300 transition-colors">
              {name}
            </h3>
            <span className="text-xs text-slate-500">Collection</span>
          </div>

          {description && (
            <p className="text-slate-400 text-xs line-clamp-2">{description}</p>
          )}

          <div className="mt-auto flex items-center justify-between text-slate-500 text-xs">
            <span title="Likes">♥ {likeCount}</span>
            <span>{formatDate(createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
