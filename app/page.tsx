import Link from 'next/link';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import {
  listSchematics,
  countSchematics,
  searchSchematics,
  countSearchResults,
  listCollections,
  countCollections,
  searchCollections,
  countCollectionSearchResults,
  getCollectionSchematics,
} from '@/lib/db';
import SchematicCard from '@/components/SchematicCard';
import CollectionCard from '@/components/CollectionCard';
import PerPageSelector from '@/components/PerPageSelector';
import SearchBar from '@/components/SearchBar';
import SortSelector from '@/components/SortSelector';

const ALLOWED_LIMITS = [12, 24, 48, 100] as const;
type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

function parseLimit(raw: string | undefined): AllowedLimit {
  const n = parseInt(raw ?? '24', 10);
  return (ALLOWED_LIMITS as readonly number[]).includes(n) ? (n as AllowedLimit) : 24;
}

function parseSort(raw: string | undefined): 'newest' | 'most_liked' {
  if (raw === 'most_liked' || raw === 'newest') return raw;
  return 'most_liked'; // default
}

interface PageProps {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sort?: string }>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const { page: pageParam, limit: limitParam, search: searchParam, sort: sortParam } = await searchParams;
  const limit = parseLimit(limitParam);
  const cookieStore = await cookies();
  const cookieSort = cookieStore.get('sort_pref')?.value;
  const sort = parseSort(sortParam ?? cookieSort);
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const offset = (page - 1) * limit;
  const searchQuery = searchParam?.trim() ?? '';

  const [records, total] = searchQuery
    ? await Promise.all([
        searchSchematics(searchQuery, limit, offset, sort),
        countSearchResults(searchQuery),
      ])
    : await Promise.all([
        listSchematics(limit, offset, sort),
        countSchematics(),
      ]);

  const totalPages = Math.ceil(total / limit);

  // Collections section — searched when a query is active
  const [collections, collectionCount] = searchQuery
    ? await Promise.all([searchCollections(searchQuery, 12, 0, sort), countCollectionSearchResults(searchQuery)])
    : await Promise.all([listCollections(12, 0, sort), countCollections()]);

  // For each collection, look up the first schematic id for its thumbnail + member count
  const collectionFirstIds: Record<string, string | null> = {};
  const collectionMemberCounts: Record<string, number> = {};
  for (const c of collections) {
    const members = await getCollectionSchematics(c.id);
    collectionFirstIds[c.id] = members[0]?.id ?? null;
    collectionMemberCounts[c.id] = members.length;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Gallery</h1>
        <p className="text-slate-400 mt-1">
          Browse and share Vintage Story chisel schematics
          {total > 0 && !searchQuery && (
            <span className="ml-2 text-slate-500">— {total} schematic{total !== 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      {/* Search bar + Sort */}
      <div className="mb-4">
        <Suspense fallback={null}>
          <SearchBar defaultValue={searchQuery} />
        </Suspense>
      </div>
      <div className="mb-6 flex justify-end">
        <Suspense fallback={null}>
          <SortSelector currentSort={sort} />
        </Suspense>
      </div>

      {/* Search context */}
      {searchQuery && (
        <p className="mb-4 text-slate-400 text-sm">
          {total === 0 && collectionCount === 0
            ? `No results for "${searchQuery}"`
            : `${total + collectionCount} result${total + collectionCount !== 1 ? 's' : ''} for "${searchQuery}"`}
        </p>
      )}

      {/* Collections section */}
      {collectionCount > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-200">Collections</h2>
            <Link
              href="/upload/collection"
              className="text-amber-500 hover:text-amber-400 text-sm transition-colors"
            >
              + New collection
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                id={c.id}
                name={c.name}
                description={c.description}
                createdAt={c.created_at}
                memberCount={collectionMemberCounts[c.id] ?? 0}
                firstSchematicId={collectionFirstIds[c.id]}
                likeCount={c.like_count ?? 0}
                thumbnailImageId={c.thumbnail_image_id ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {records.length === 0 && collectionCount === 0 ? (
        <div className="text-center py-28">
          {searchQuery ? (
            <>
              <h2 className="text-xl text-slate-400 mb-4">No results found</h2>
              <Link
                href="/"
                className="text-amber-500 hover:text-amber-400 text-sm transition-colors"
              >
                ← Clear search
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl text-slate-400 mb-6">No schematics yet</h2>
              <Link
                href="/upload"
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Upload the first one
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Schematics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {records.map((s) => (
              <SchematicCard
                key={s.id}
                id={s.id}
                name={s.name}
                displayName={s.display_name}
                uploadedAt={s.uploaded_at}
                downloadCount={s.download_count}
                likeCount={s.like_count ?? 0}
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
                    href={`/?page=${page - 1}&limit=${limit}&sort=${sort}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`}
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
                    href={`/?page=${page + 1}&limit=${limit}&sort=${sort}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`}
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
