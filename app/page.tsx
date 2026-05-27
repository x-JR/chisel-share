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
import ViewSelector from '@/components/ViewSelector';

const ALLOWED_LIMITS = [12, 24, 48, 100] as const;
type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

function parseLimit(raw: string | undefined): AllowedLimit {
  const n = parseInt(raw ?? '24', 10);
  return (ALLOWED_LIMITS as readonly number[]).includes(n) ? (n as AllowedLimit) : 24;
}

function parseSort(raw: string | undefined): 'newest' | 'most_liked' {
  if (raw === 'most_liked' || raw === 'newest') return raw;
  return 'most_liked';
}

function parseView(raw: string | undefined): 'both' | 'schematics' | 'collections' {
  if (raw === 'schematics' || raw === 'collections') return raw;
  return 'both';
}

interface PageProps {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sort?: string; view?: string }>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const { page: pageParam, limit: limitParam, search: searchParam, sort: sortParam, view: viewParam } = await searchParams;
  const limit = parseLimit(limitParam);
  const cookieStore = await cookies();
  const cookieSort = cookieStore.get('sort_pref')?.value;
  const sort = parseSort(sortParam ?? cookieSort);
  const view = parseView(viewParam);
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const offset = (page - 1) * limit;
  const searchQuery = searchParam?.trim() ?? '';

  // Build a base query string for pagination links (preserves all params except page)
  function pageLink(p: number) {
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', String(limit));
    params.set('sort', sort);
    if (searchQuery) params.set('search', searchQuery);
    if (view !== 'both') params.set('view', view);
    return `/?${params.toString()}`;
  }

  // Fetch schematics unless we're in collections-only mode
  const showSchematics = view !== 'collections';
  const showCollections = view !== 'schematics';

  const [records, total] = showSchematics
    ? searchQuery
      ? await Promise.all([searchSchematics(searchQuery, limit, offset, sort), countSearchResults(searchQuery)])
      : await Promise.all([listSchematics(limit, offset, sort), countSchematics()])
    : [[], 0];

  // Collections: paginated when in collections-only mode, otherwise first 12
  const collectionLimit = showCollections ? (view === 'collections' ? limit : 12) : 0;
  const collectionOffset = view === 'collections' ? offset : 0;

  const [collections, collectionCount] = showCollections
    ? searchQuery
      ? await Promise.all([
          searchCollections(searchQuery, collectionLimit, collectionOffset, sort),
          countCollectionSearchResults(searchQuery),
        ])
      : await Promise.all([
          listCollections(collectionLimit, collectionOffset, sort),
          countCollections(),
        ])
    : [[], 0];

  // Determine which count drives pagination
  const paginatedTotal = view === 'collections' ? collectionCount : total;
  const totalPages = Math.ceil(paginatedTotal / limit);

  // For each collection, look up the first schematic id for its thumbnail + member count
  const collectionFirstIds: Record<string, string | null> = {};
  const collectionMemberCounts: Record<string, number> = {};
  for (const c of collections) {
    const members = await getCollectionSchematics(c.id);
    collectionFirstIds[c.id] = members[0]?.id ?? null;
    collectionMemberCounts[c.id] = members.length;
  }

  const isEmpty = records.length === 0 && collections.length === 0;

  // Result count for search summary
  const visibleResultCount =
    view === 'schematics' ? total :
    view === 'collections' ? collectionCount :
    total + collectionCount;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Gallery</h1>
        <p className="text-slate-400 mt-1">
          Browse and share Vintage Story chisel schematics
          {total > 0 && !searchQuery && view !== 'collections' && (
            <span className="ml-2 text-slate-500">— {total} schematic{total !== 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <Suspense fallback={null}>
          <SearchBar defaultValue={searchQuery} />
        </Suspense>
      </div>

      {/* Controls row: View selector + Sort */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Suspense fallback={null}>
          <ViewSelector currentView={view} />
        </Suspense>
        <Suspense fallback={null}>
          <SortSelector currentSort={sort} />
        </Suspense>
      </div>

      {/* Search context */}
      {searchQuery && (
        <p className="mb-4 text-slate-400 text-sm">
          {visibleResultCount === 0
            ? `No results for "${searchQuery}"`
            : `${visibleResultCount} result${visibleResultCount !== 1 ? 's' : ''} for "${searchQuery}"`}
        </p>
      )}

      {/* Collections section */}
      {showCollections && collectionCount > 0 && (
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
      {isEmpty ? (
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
          {/* Schematics section */}
          {showSchematics && records.length > 0 && (
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
            </>
          )}

          {/* Pagination */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <PerPageSelector currentLimit={limit} />
            {totalPages > 1 && (
              <>
                {page > 1 && (
                  <Link
                    href={pageLink(page - 1)}
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
                    href={pageLink(page + 1)}
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
