import { NextRequest, NextResponse } from 'next/server';
import { getSchematic } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) {
    return new NextResponse('Not found', { status: 404 });
  }

  let xmlContent: string;
  try {
    xmlContent = await fs.readFile(path.join(schematicsDir(), record.filename), 'utf-8');
  } catch {
    return new NextResponse('File not found', { status: 404 });
  }

  // Sanitise the filename for the Content-Disposition header
  const title = (record.display_name || record.name).replace(/[^a-zA-Z0-9 _-]/g, '_');

  return new NextResponse(xmlContent, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${title}.xml"`,
    },
  });
}
