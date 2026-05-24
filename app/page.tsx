import Link from 'next/link';
import { listSchematics, countSchematics } from '@/lib/db';
import SchematicCard from '@/components/SchematicCard';
import PerPageSelector from '@/components/PerPageSelector';

const ALLOWED_LIMITS = [12, 24, 48, 100] as const;
type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

function parseLimit(raw: string | undefined): AllowedLimit {
  const n = parseInt(raw ?? '24', 10);
  return (ALLOWED_LIMITS as readonly number[]).includes(n) ? (n as AllowedLimit) : 24;
}

interface PageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const { page: pageParam, limit: limitParam } = await searchParams;
  const limit = parseLimit(limitParam);
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const offset = (page - 1) * limit;

  const records = await listSchematics(limit, offset);
  const total = await countSchematics();
  const totalPages = Math.ceil(total / limit);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Gallery</h1>
        <p className="text-slate-400 mt-1">
          Browse and share Vintage Story chisel schematics
          {total > 0 && (
            <span className="ml-2 text-slate-500">— {total} schematic{total !== 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      {/* Empty state */}
      {records.length === 0 ? (
        <div className="text-center py-28">
          <h2 className="text-xl text-slate-400 mb-6">No schematics yet</h2>
          <Link
            href="/upload"
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Upload the first one
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {records.map((s) => (
              <SchematicCard
                key={s.id}
                id={s.id}
                name={s.name}
                displayName={s.display_name}
                blockcodes={JSON.parse(s.blockcodes) as string[]}
                cuboidCount={s.cuboid_count}
                uploadedAt={s.uploaded_at}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <PerPageSelector currentLimit={limit} />
            {totalPages > 1 && (
              <>
                {page > 1 && (
                  <Link
                    href={`/?page=${page - 1}&limit=${limit}`}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    ← Previous
                  </Link>
                )}
                <span className="text-slate-500 text-sm">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/?page=${page + 1}&limit=${limit}`}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
