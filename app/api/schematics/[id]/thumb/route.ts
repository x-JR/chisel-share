import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSchematic } from '@/lib/db';
import { logAction } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import path from 'path';
import fs from 'fs/promises';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_THUMB_SIZE = 512 * 1024; // 512 KB

function thumbsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'thumbs');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const data = await fs.readFile(path.join(thumbsDir(), `${id}.png`));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
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

  // Rate-limit owners to 1 regeneration per schematic per 10 minutes.
  // Admins are exempt.
  if (!isAdmin) {
    const rl = checkRateLimit(id, 'regen_thumb', 1, 10 * 60 * 1000);
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const thumbFile = formData.get('thumbnail');
  if (!(thumbFile instanceof File) || thumbFile.size === 0) {
    return NextResponse.json({ error: 'No thumbnail provided' }, { status: 400 });
  }
  if (thumbFile.size > MAX_THUMB_SIZE) {
    return NextResponse.json({ error: 'Thumbnail too large (max 512 KB)' }, { status: 400 });
  }

  const thumbBuf = Buffer.from(await thumbFile.arrayBuffer());
  if (
    thumbBuf.length < PNG_MAGIC.length ||
    !thumbBuf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
  ) {
    return NextResponse.json({ error: 'File is not a valid PNG' }, { status: 400 });
  }

  const tDir = thumbsDir();
  await fs.mkdir(tDir, { recursive: true });
  await fs.writeFile(path.join(tDir, `${id}.png`), thumbBuf);

  logAction({
    request,
    action: 'regenerate_thumb',
    resourceType: 'schematic',
    resourceId: id,
    status: 'success',
  });

  return NextResponse.json({ ok: true });
}
