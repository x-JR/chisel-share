import { NextRequest, NextResponse } from 'next/server';
import { getCollection, getCollectionSchematics, incrementDownloadCount } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    return new NextResponse('Not found', { status: 404 });
  }

  const schematics = await getCollectionSchematics(id);
  if (schematics.length === 0) {
    return new NextResponse('Collection is empty', { status: 404 });
  }

  const zip = new JSZip();
  const dir = schematicsDir();

  for (let i = 0; i < schematics.length; i++) {
    const s = schematics[i];
    const content = await fs.readFile(path.join(dir, s.filename), 'utf-8').catch(() => null);
    if (content === null) continue;

    const title = (s.display_name || s.name).replace(/[^a-zA-Z0-9 _-]/g, '_');
    const partLabel = schematics.length > 1 ? `Part_${i + 1}_` : '';
    zip.file(`${partLabel}${title}.xml`, content);

    // Fire-and-forget download count increments
    incrementDownloadCount(s.id).catch(() => {});
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  const collectionTitle = collection.name.replace(/[^a-zA-Z0-9 _-]/g, '_');

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${collectionTitle}.zip"`,
    },
  });
}
