import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import {
  getCollection,
  getCollectionSchematics,
  getCollectionLikeCount,
  getCollectionImages,
  getCollectionReportCount,
  getComments,
} from '@/lib/db';
import EditCollectionClient from '@/components/EditCollectionClient';
import CommentsSection from '@/components/CommentsSection';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) return {};

  const description = collection.description
    ? `${collection.description.slice(0, 140)} — Vintage Story QP Chisel schematic collection`
    : `${collection.name} — A collection of QP Chisel schematics for Vintage Story. Download and use in your world.`;

  return {
    title: collection.name,
    description,
    openGraph: {
      title: `${collection.name} | Chisel Share`,
      description,
      type: 'article',
    },
  };
}

export default async function CollectionViewPage({ params }: PageProps) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) notFound();

  const schematics = await getCollectionSchematics(id);
  const likeCount = await getCollectionLikeCount(id);
  const images = await getCollectionImages(id);

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;
  const canEdit =
    isAdmin || (!!collection.uploader_token && collection.uploader_token === uploaderToken);

  const reportCount = isAdmin ? await getCollectionReportCount(id) : undefined;

  const comments = await getComments('collection', id);

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

      <EditCollectionClient
        collection={{
          id: collection.id,
          name: collection.name,
          description: collection.description,
          author_name: collection.author_name ?? null,
          created_at: collection.created_at,
        }}
        schematics={schematics.map((s) => ({
          id: s.id,
          name: s.name,
          display_name: s.display_name,
          description: s.description,
          uploaded_at: s.uploaded_at,
          download_count: s.download_count,
          like_count: s.like_count ?? 0,
        }))}
        images={images.map((img) => ({
          id: img.id,
          display_order: img.display_order,
          ext: img.ext,
        }))}
        likeCount={likeCount}
        canEdit={canEdit}
        isAdmin={isAdmin}
        reportCount={reportCount}
      />

      <CommentsSection
        targetType="collection"
        targetId={collection.id}
        initialComments={comments}
        isAdmin={isAdmin}
      />
    </main>
  );
}
