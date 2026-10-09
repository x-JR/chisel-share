import Link from 'next/link';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import {
  listSchematics,
  countSchematics,
  countAllSchematics,
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

/** Builds a compact page-number sequence with ellipsis gaps, e.g. [1, 2, '…', 9, 10]. */
function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
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

  const totalAllSchematics = !searchQuery ? await countAllSchematics() : 0;

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
  const pageNumbers = totalPages > 1 ? getPageNumbers(page, totalPages) : [];

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">Gallery</h1>
        <p className="mt-2 text-slate-400">
          Browse and share Vintage Story chisel schematics
          {totalAllSchematics > 0 && !searchQuery && view !== 'collections' && (
            <span className="ml-2 text-slate-500">
              — {totalAllSchematics} schematic{totalAllSchematics !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Toolbar: search + filters */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
        <Suspense fallback={null}>
          <SearchBar defaultValue={searchQuery} />
        </Suspense>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
          <Suspense fallback={null}>
            <ViewSelector currentView={view} />
          </Suspense>
          <Suspense fallback={null}>
            <SortSelector currentSort={sort} />
          </Suspense>
        </div>
      </div>

      {/* Search context */}
      {searchQuery && (
        <p className="mb-5 text-sm text-slate-400">
          {visibleResultCount === 0
            ? `No results for "${searchQuery}"`
            : `${visibleResultCount} result${visibleResultCount !== 1 ? 's' : ''} for "${searchQuery}"`}
        </p>
      )}

      {/* Collections section */}
      {showCollections && collectionCount > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-baseline gap-2 text-xl font-semibold text-slate-200">
              📦 Collections
              {view === 'both' && (
                <span className="text-sm font-normal text-slate-500">
                  {collectionCount > collectionLimit
                    ? `showing ${collectionLimit} of ${collectionCount}`
                    : `${collectionCount}`}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4">
              {view === 'both' && collectionCount > collectionLimit && (
                <Link
                  href={`/?view=collections${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`}
                  className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                >
                  View all {collectionCount} →
                </Link>
              )}
              <Link
                href="/upload/collection"
                className="text-sm text-amber-500 transition-colors hover:text-amber-400"
              >
                + New collection
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                id={c.id}
                name={c.name}
                description={c.description}
                authorName={c.author_name ?? null}
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
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 py-24 text-center">
          {searchQuery ? (
            <>
              <p className="mb-3 text-4xl">🔍</p>
              <h2 className="mb-4 text-xl text-slate-400">No results found</h2>
              <Link
                href="/"
                className="text-sm text-amber-500 transition-colors hover:text-amber-400"
              >
                ← Clear search
              </Link>
            </>
          ) : (
            <>
              <p className="mb-3 text-4xl">🗂️</p>
              <h2 className="mb-6 text-xl text-slate-400">No schematics yet</h2>
              <Link
                href="/upload"
                className="rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-500"
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
            <section>
              <h2 className="mb-4 text-xl font-semibold text-slate-200">🧱 Schematics</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {records.map((s) => (
                  <SchematicCard
                    key={s.id}
                    id={s.id}
                    name={s.name}
                    displayName={s.display_name}
                    description={s.description}
                    authorName={s.author_name ?? null}
                    uploadedAt={s.uploaded_at}
                    downloadCount={s.download_count}
                    likeCount={s.like_count ?? 0}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Pagination */}
          <div className="mt-12 flex flex-col items-center gap-4 border-t border-slate-800 pt-8">
            <PerPageSelector currentLimit={limit} />
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
                <Link
                  href={pageLink(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    page <= 1
                      ? 'pointer-events-none text-slate-700'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  ← Prev
                </Link>
                {pageNumbers.map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-sm text-slate-600">
                      …
                    </span>
                  ) : (
                    <Link
                      key={p}
                      href={pageLink(p)}
                      aria-current={p === page ? 'page' : undefined}
                      className={`min-w-[2.25rem] rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                )}
                <Link
                  href={pageLink(Math.min(totalPages, page + 1))}
                  aria-disabled={page >= totalPages}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    page >= totalPages
                      ? 'pointer-events-none text-slate-700'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  Next →
                </Link>
              </nav>
            )}
          </div>
        </>
      )}
    </main>
  );
}
