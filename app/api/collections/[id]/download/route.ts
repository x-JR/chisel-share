import { NextRequest, NextResponse } from 'next/server';
import { getCollection, getCollectionSchematics, incrementDownloadCount } from '@/lib/db';
import { logAction } from '@/lib/logger';
import { convertXmlToChiselWizDesign } from '@/lib/chiselwiz-server';
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    logAction({ request, action: 'download', resourceType: 'collection', resourceId: id, status: 'not_found' });
    return new NextResponse('Not found', { status: 404 });
  }

  const schematics = await getCollectionSchematics(id);
  if (schematics.length === 0) {
    logAction({ request, action: 'download', resourceType: 'collection', resourceId: id, status: 'empty' });
    return new NextResponse('Collection is empty', { status: 404 });
  }

  const dir = schematicsDir();
  const collectionTitle = collection.name.replace(/[^a-zA-Z0-9 _-]/g, '_');

  const format = request.nextUrl.searchParams.get('format');
  if (format === 'chiselwiz') {
    const designs = [];
    for (const s of schematics) {
      const content = await fs.readFile(path.join(dir, s.filename), 'utf-8').catch(() => null);
      if (content === null) continue;
      designs.push(convertXmlToChiselWizDesign(content, s.display_name || s.name));
      incrementDownloadCount(s.id).catch(() => {});
    }
    const catalogue = JSON.stringify({ version: 1, designs }, null, 2);
    logAction({
      request,
      action: 'download',
      resourceType: 'collection',
      resourceId: id,
      details: { schematicCount: schematics.length, format: 'chiselwiz' },
    });
    return new NextResponse(catalogue, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${collectionTitle}.json"`,
      },
    });
  }

  const zip = new JSZip();

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

  // Fire-and-forget download log
  logAction({
    request,
    action: 'download',
    resourceType: 'collection',
    resourceId: id,
    details: { schematicCount: schematics.length },
  });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${collectionTitle}.zip"`,
    },
  });
}
