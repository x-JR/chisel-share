import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSchematic } from '@/lib/db';
import { logAction } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import path from 'path';
import fs from 'fs/promises';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;
const MAX_VOXELDATA_LEN = 65_536; // well above the theoretical max (~32 KB base64)

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;

  const record = await getSchematic(id);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwner = !!record.uploader_token && record.uploader_token === uploaderToken;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate-limit owners to 3 saves per hour per schematic. Admins are exempt.
  if (!isAdmin) {
    const rl = checkRateLimit(id, 'rotate_schematic', 3, 60 * 60 * 1000);
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }
  }

  let body: { voxeldata?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.voxeldata !== 'string' || !body.voxeldata) {
    return NextResponse.json({ error: 'voxeldata is required' }, { status: 400 });
  }

  const voxeldataStr = body.voxeldata.replace(/\s/g, '');
  if (voxeldataStr.length > MAX_VOXELDATA_LEN) {
    return NextResponse.json({ error: 'voxeldata too large' }, { status: 400 });
  }
  if (!BASE64_RE.test(voxeldataStr)) {
    return NextResponse.json({ error: 'Invalid voxeldata encoding' }, { status: 400 });
  }

  const filePath = path.join(schematicsDir(), record.filename);
  let xml: string;
  try {
    xml = await fs.readFile(filePath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Schematic file not found' }, { status: 404 });
  }

  // Chisel Wiz JSON files are not supported by this endpoint
  if (xml.trimStart().startsWith('{')) {
    return NextResponse.json(
      { error: 'Rotation is not supported for Chisel Wiz format schematics' },
      { status: 422 },
    );
  }

  const newXml = xml.replace(
    /(<voxeldata[^>]*>)[^<]*(<\/voxeldata>)/,
    `$1${voxeldataStr}$2`,
  );

  if (newXml === xml) {
    return NextResponse.json(
      { error: 'Failed to locate voxeldata in schematic file' },
      { status: 500 },
    );
  }

  await fs.writeFile(filePath, newXml, 'utf-8');

  logAction({
    request,
    action: 'rotate',
    resourceType: 'schematic',
    resourceId: id,
    voterToken: uploaderToken,
    status: 'success',
  });

  return NextResponse.json({ xmlContent: newXml });
}
