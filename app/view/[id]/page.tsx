import { notFound } from 'next/navigation';
import Link from 'next/link';
import path from 'path';
import fs from 'fs/promises';
import { cookies } from 'next/headers';
import { getSchematic } from '@/lib/db';
import { blockcodeToColor } from '@/lib/texture-resolver';
import DeleteButton from '@/components/DeleteButton';
import SchematicViewer from '@/components/SchematicViewerClient';
import LikeButton from '@/components/LikeButton';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

interface PageProps {
  params: Promise<{ id: string }>;
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
  const title = record.display_name || record.name;

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;
  const canDelete =
    isAdmin || (!!record.uploader_token && record.uploader_token === uploaderToken);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to gallery
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
          {/* Title card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h1 className="text-2xl font-bold text-amber-400 break-words">{title}</h1>
            {record.display_name && (
              <p className="text-slate-500 text-sm mt-1 break-words">{record.name}</p>
            )}
            {record.description && (
              <p className="text-slate-300 text-sm mt-3 leading-relaxed">
                {record.description}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-slate-800 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Cuboids</span>
                <span className="text-slate-200">{record.cuboid_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Downloads</span>
                <span className="text-slate-200">{record.download_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Likes</span>
                <span className="text-slate-200">{record.like_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Uploaded</span>
                <span className="text-slate-200">
                  {new Date(record.uploaded_at * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Materials */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-slate-300 font-semibold mb-3">
              Materials ({blockcodes.length})
            </h2>
            <div className="space-y-2">
              {blockcodes.map((code, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded flex-shrink-0 border border-slate-700"
                    style={{ backgroundColor: blockcodeToColor(code) }}
                  />
                  <span
                    className="text-slate-300 text-sm font-mono truncate"
                    title={code}
                  >
                    {code.replace(/^game:/, '')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2.5">
            <a
              href={`/api/schematics/${record.id}/download`}
              className="block w-full text-center bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              ⬇ Download Schematic
            </a>
            <LikeButton apiPath={`/api/schematics/${record.id}/like`} initialCount={record.like_count ?? 0} />
            {canDelete && <DeleteButton id={record.id} />}
          </div>
        </div>
      </div>
    </main>
  );
}
