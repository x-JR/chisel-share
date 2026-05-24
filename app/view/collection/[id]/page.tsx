import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getCollection, getCollectionSchematics, getCollectionLikeCount } from '@/lib/db';
import SchematicCard from '@/components/SchematicCard';
import DeleteCollectionButton from '@/components/DeleteCollectionButton';
import LikeButton from '@/components/LikeButton';
import DownloadButton from '@/components/DownloadButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionViewPage({ params }: PageProps) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) notFound();

  const schematics = await getCollectionSchematics(id);
  const likeCount = await getCollectionLikeCount(id);

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;
  const canDelete =
    isAdmin || (!!collection.uploader_token && collection.uploader_token === uploaderToken);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to gallery
        </Link>
      </div>

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-amber-400 break-words">{collection.name}</h1>
            <span className="text-xs bg-amber-700/40 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full font-medium">
              Collection · {schematics.length} {schematics.length === 1 ? 'part' : 'parts'}
            </span>
          </div>
          {collection.description && (
            <p className="text-slate-300 text-sm mt-3 leading-relaxed max-w-2xl">
              {collection.description}
            </p>
          )}
          <p className="text-slate-500 text-sm mt-2">
            Uploaded{' '}
            {new Date(collection.created_at * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {canDelete && (
          <div className="shrink-0">
            <DeleteCollectionButton id={id} />
          </div>
        )}
        <div className="shrink-0 flex flex-col gap-2">
          <DownloadButton
            href={`/api/collections/${id}/download`}
            filename={`${collection.name.replace(/[^a-zA-Z0-9 _-]/g, '_')}.zip`}
            label="⬇ Download All"
            className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-4 py-2 rounded-lg border border-slate-600 transition-colors"
          />
          <div className="w-40">
            <LikeButton apiPath={`/api/collections/${id}/like`} initialCount={likeCount} />
          </div>
        </div>
      </div>

      {/* Parts grid */}
      {schematics.length === 0 ? (
        <p className="text-slate-500 text-center py-16">No schematics in this collection.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {schematics.map((s, i) => (
            <div key={s.id} className="relative">
              <span className="absolute top-2 left-2 z-10 bg-slate-900/80 text-slate-400 text-xs font-mono px-2 py-0.5 rounded-full border border-slate-700">
                Part {i + 1}
              </span>
              <SchematicCard
                id={s.id}
                name={s.name}
                displayName={s.display_name}
                uploadedAt={s.uploaded_at}
                downloadCount={s.download_count}
                likeCount={s.like_count ?? 0}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
