import { NextRequest, NextResponse } from 'next/server';
import { getSchematic, incrementDownloadCount } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAction, getClientIp } from '@/lib/logger';
import { convertXmlToChiselWiz } from '@/lib/chiselwiz-server';
import path from 'path';
import fs from 'fs/promises';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

// 30 downloads per minute per IP
const DOWNLOAD_LIMIT = 30;
const DOWNLOAD_WINDOW_MS = 60_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, 'download', DOWNLOAD_LIMIT, DOWNLOAD_WINDOW_MS);
  if (!rl.allowed) {
    logAction({
      request,
      action: 'download',
      resourceType: 'schematic',
      status: 'rate_limited',
      details: { retryAfterMs: rl.retryAfterMs },
    });
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
      },
    });
  }

  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) {
    logAction({ request, action: 'download', resourceType: 'schematic', resourceId: id, status: 'not_found' });
    return new NextResponse('Not found', { status: 404 });
  }

  let xmlContent: string;
  try {
    xmlContent = await fs.readFile(path.join(schematicsDir(), record.filename), 'utf-8');
  } catch {
    logAction({ request, action: 'download', resourceType: 'schematic', resourceId: id, status: 'file_missing' });
    return new NextResponse('File not found', { status: 404 });
  }

  // Fire-and-forget download count increment and log
  incrementDownloadCount(id).catch(() => {});
  logAction({ request, action: 'download', resourceType: 'schematic', resourceId: id });

  // Sanitise the filename for the Content-Disposition header
  const title = (record.display_name || record.name).replace(/[^a-zA-Z0-9 _-]/g, '_');

  const format = request.nextUrl.searchParams.get('format');
  if (format === 'chiselwiz') {
    const displayName = record.display_name || record.name;
    const json = convertXmlToChiselWiz(xmlContent, displayName);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="chiselwiz-catalogue.json"`,
      },
    });
  }

  return new NextResponse(xmlContent, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${title}.xml"`,
    },
  });
}
