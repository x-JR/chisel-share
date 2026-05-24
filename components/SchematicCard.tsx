import Link from 'next/link';
import { blockcodeToColor } from '@/lib/texture-resolver';
import ThumbnailImage from '@/components/ThumbnailImage';

interface Props {
  id: string;
  name: string;
  displayName: string | null;
  blockcodes: string[];
  cuboidCount: number;
  uploadedAt: number;
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
  blockcodes,
  cuboidCount,
  uploadedAt,
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
        </div>

        {/* Material swatches */}
        <div className="flex flex-wrap gap-1.5">
          {blockcodes.slice(0, 8).map((code, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-slate-700/70 rounded px-2 py-1"
              title={code}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: blockcodeToColor(code) }}
              />
              <span className="text-slate-400 text-xs truncate max-w-[120px]">
                {code.replace(/^game:/, '')}
              </span>
            </div>
          ))}
          {blockcodes.length > 8 && (
            <span className="text-slate-500 text-xs self-center">
              +{blockcodes.length - 8} more
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between text-slate-500 text-xs">
          <span>{cuboidCount} cuboid{cuboidCount !== 1 ? 's' : ''}</span>
          <span>{formatDate(uploadedAt)}</span>
        </div>
        </div>
      </div>
    </Link>
  );
}
