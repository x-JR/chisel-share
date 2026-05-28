import { notFound } from 'next/navigation';
import Link from 'next/link';
import path from 'path';
import fs from 'fs/promises';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { getSchematic } from '@/lib/db';
import { blockcodeToColor, resolveTexture } from '@/lib/texture-resolver';
import SchematicViewer from '@/components/SchematicViewerClient';
import EditSchematicClient from '@/components/EditSchematicClient';
import RegenerateThumbnailButton from '@/components/RegenerateThumbnailButton';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) return {};

  const title = record.display_name ?? record.name;
  const description = record.description
    ? `${record.description.slice(0, 140)} — Vintage Story QP Chisel schematic`
    : `${title} — A QP Chisel schematic for Vintage Story. Download and use in your world.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Chisel Share`,
      description,
      type: 'article',
    },
  };
}

export default async function ViewPage({ params }: PageProps) {
  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) notFound();

  let xmlContent: string;
  try {
    xmlContent = await fs.readFile(
      path.join(schematicsDir(), record.filename),
      'utf-8'
    );
  } catch {
    notFound();
  }

  const blockcodes: string[] = JSON.parse(record.blockcodes);

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;
  const canEdit =
    isAdmin || (!!record.uploader_token && record.uploader_token === uploaderToken);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={record.collection_id ? `/view/collection/${record.collection_id}` : '/'}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          {record.collection_id ? '← Back to collection' : '← Back to gallery'}
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 3-D Viewer */}
        <div className="lg:flex-1 min-w-0">
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
            style={{ height: '520px' }}
          >
            <SchematicViewer xmlContent={xmlContent} className="w-full h-full" />
          </div>
          <p className="text-slate-600 text-xs mt-2 text-center">
            Drag to rotate &nbsp;·&nbsp; Scroll to zoom &nbsp;·&nbsp; Right-drag to pan
          </p>
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 flex-shrink-0 flex flex-col gap-4">
          <EditSchematicClient
            id={record.id}
            initialDisplayName={record.display_name ?? record.name}
            initialDescription={record.description}
            initialAuthorName={record.author_name ?? null}
            schematicName={record.name}
            cuboidCount={record.cuboid_count}
            downloadCount={record.download_count}
            likeCount={record.like_count ?? 0}
            uploadedAt={record.uploaded_at}
            canEdit={canEdit}
          />

          {/* Admin tools */}
          {isAdmin && (
            <div className="bg-slate-900 border border-amber-800/40 rounded-xl p-5">
              <h2 className="text-amber-400 font-semibold text-sm mb-3">Admin</h2>
              <RegenerateThumbnailButton id={record.id} />
            </div>
          )}

          {/* Materials */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-slate-300 font-semibold mb-3">
              Materials ({blockcodes.length})
            </h2>
            <div className="space-y-2">
              {blockcodes.map((code, i) => {
                const texUrl = resolveTexture(code);
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    {texUrl ? (
                      <img
                        src={texUrl}
                        alt={code}
                        className="w-4 h-4 rounded flex-shrink-0 border border-slate-700 object-cover"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span
                        className="w-4 h-4 rounded flex-shrink-0 border border-slate-700"
                        style={{ backgroundColor: blockcodeToColor(code) }}
                      />
                    )}
                    <span
                      className="text-slate-300 text-sm font-mono truncate"
                      title={code}
                    >
                      {code.replace(/^game:/, '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
