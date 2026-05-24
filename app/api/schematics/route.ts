import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listSchematics, insertSchematic, countSchematics } from '@/lib/db';
import { parseSchematicMeta } from '@/lib/schematic-parser';
import { generateThumbnail } from '@/lib/thumbnail';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAction, getClientIp } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_THUMB_SIZE = 512 * 1024; // 512 KB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

function thumbsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'thumbs');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 24;
  const offset = (page - 1) * limit;

  const records = await listSchematics(limit, offset);
  const total = await countSchematics();

  return NextResponse.json({
    schematics: records.map((s) => ({
      ...s,
      blockcodes: JSON.parse(s.blockcodes) as string[],
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// 5 uploads per 10 minutes per IP
const UPLOAD_LIMIT = 5;
const UPLOAD_WINDOW_MS = 10 * 60_000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, 'upload', UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!rl.allowed) {
    logAction({
      request,
      action: 'upload',
      resourceType: 'schematic',
      status: 'rate_limited',
      details: { retryAfterMs: rl.retryAfterMs },
    });
    return NextResponse.json(
      { error: 'Too many uploads. Please wait before uploading again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large (max 2 MB)' },
      { status: 400 }
    );
  }

  const xmlContent = await file.text();

  // Basic validation: must be a PantographData XML
  if (
    !xmlContent.includes('<PantographData') &&
    !xmlContent.includes('<pantographdata')
  ) {
    return NextResponse.json(
      { error: 'Not a valid QP Chisel schematic file' },
      { status: 400 }
    );
  }

  const meta = parseSchematicMeta(xmlContent);

  if (!meta.blockcodes.length) {
    return NextResponse.json(
      { error: 'No blockcodes found in schematic' },
      { status: 400 }
    );
  }

  const displayName =
    (formData.get('display_name') as string | null)?.trim().slice(0, 120) || null;
  if (!displayName) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
  }
  const description =
    (formData.get('description') as string | null)?.trim().slice(0, 1000) || null;

  const cookieStore = await cookies();
  let uploaderToken = cookieStore.get('uploader_token')?.value;
  if (!uploaderToken || !/^[0-9a-f-]{36}$/.test(uploaderToken)) {
    uploaderToken = uuidv4();
  }

  const id = uuidv4();
  const filename = `${id}.xml`;
  const dir = schematicsDir();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), xmlContent, 'utf-8');

  const record = {
    id,
    name: meta.name,
    display_name: displayName,
    description,
    filename,
    blockcodes: JSON.stringify(meta.blockcodes),
    cuboid_count: meta.cuboidCount,
    uploaded_at: Math.floor(Date.now() / 1000),
    uploader_token: uploaderToken,
    download_count: 0,
    collection_id: null,
    collection_order: 0,
  };

  await insertSchematic(record);

  // Save thumbnail — prefer client-rendered PNG, fall back to server-side generation
  try {
    const tDir = thumbsDir();
    await fs.mkdir(tDir, { recursive: true });

    const clientThumb = formData.get('thumbnail');
      if (
        clientThumb instanceof File &&
        clientThumb.size > 0 &&
        clientThumb.size <= MAX_THUMB_SIZE
      ) {
        const thumbBuf = Buffer.from(await clientThumb.arrayBuffer());
        // Validate PNG magic bytes before writing
        if (
          thumbBuf.length >= PNG_MAGIC.length &&
          thumbBuf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
        ) {
          await fs.writeFile(path.join(tDir, `${id}.png`), thumbBuf);
        }
    } else {
      const thumbBuf = generateThumbnail(xmlContent);
      if (thumbBuf) {
        await fs.writeFile(path.join(tDir, `${id}.png`), thumbBuf);
      }
    }
  } catch {
    // Thumbnail failure does not affect the upload
  }

  logAction({
    request,
    action: 'upload',
    resourceType: 'schematic',
    resourceId: id,
    voterToken: uploaderToken,
    details: { name: displayName, cuboidCount: meta.cuboidCount },
  });

  const response = NextResponse.json(
    { ...record, blockcodes: meta.blockcodes },
    { status: 201 }
  );
  response.cookies.set('uploader_token', uploaderToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return response;
}
