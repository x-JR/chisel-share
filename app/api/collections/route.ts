import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import {
  insertSchematic,
  insertCollection,
} from '@/lib/db';
import { parseSchematicMeta } from '@/lib/schematic-parser';
import { generateThumbnail } from '@/lib/thumbnail';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_THUMB_SIZE = 512 * 1024; // 512 KB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_FILES = 20;

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

function thumbsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'thumbs');
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const collectionName = (formData.get('name') as string | null)?.trim().slice(0, 120);
  if (!collectionName) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
  }
  const collectionDescription =
    (formData.get('description') as string | null)?.trim().slice(0, 1000) || null;

  const countRaw = parseInt(formData.get('count') as string ?? '0', 10);
  if (!countRaw || countRaw < 1 || countRaw > MAX_FILES) {
    return NextResponse.json(
      { error: `Must include between 1 and ${MAX_FILES} schematic files` },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  let uploaderToken = cookieStore.get('uploader_token')?.value;
  if (!uploaderToken || !/^[0-9a-f-]{36}$/.test(uploaderToken)) {
    uploaderToken = uuidv4();
  }

  const collectionId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  // Process each schematic file
  const schematicIds: string[] = [];
  const schematicDir = schematicsDir();
  const tDir = thumbsDir();
  await fs.mkdir(schematicDir, { recursive: true });
  await fs.mkdir(tDir, { recursive: true });

  for (let i = 0; i < countRaw; i++) {
    const file = formData.get(`file_${i}`);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: `Missing file at index ${i}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File ${i + 1} is too large (max 2 MB)` },
        { status: 400 }
      );
    }

    const xmlContent = await file.text();
    if (
      !xmlContent.includes('<PantographData') &&
      !xmlContent.includes('<pantographdata')
    ) {
      return NextResponse.json(
        { error: `File ${i + 1} is not a valid QP Chisel schematic` },
        { status: 400 }
      );
    }

    const meta = parseSchematicMeta(xmlContent);
    if (!meta.blockcodes.length) {
      return NextResponse.json(
        { error: `File ${i + 1} contains no blockcodes` },
        { status: 400 }
      );
    }

    const displayName =
      (formData.get(`display_name_${i}`) as string | null)?.trim().slice(0, 120) ||
      meta.name;
    const partDescription =
      (formData.get(`description_${i}`) as string | null)?.trim().slice(0, 1000) || null;

    const id = uuidv4();
    const filename = `${id}.xml`;

    await fs.writeFile(path.join(schematicDir, filename), xmlContent, 'utf-8');

    await insertSchematic({
      id,
      name: meta.name,
      display_name: displayName,
      description: partDescription,
      filename,
      blockcodes: JSON.stringify(meta.blockcodes),
      cuboid_count: meta.cuboidCount,
      uploaded_at: now,
      uploader_token: uploaderToken,
      download_count: 0,
      collection_id: collectionId,
      collection_order: i,
    });

    // Save thumbnail
    try {
      const clientThumb = formData.get(`thumbnail_${i}`);
      if (
        clientThumb instanceof File &&
        clientThumb.size > 0 &&
        clientThumb.size <= MAX_THUMB_SIZE
      ) {
        const thumbBuf = Buffer.from(await clientThumb.arrayBuffer());
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
      // Thumbnail failure does not abort the upload
    }

    schematicIds.push(id);
  }

  // Create the collection record
  await insertCollection({
    id: collectionId,
    name: collectionName,
    description: collectionDescription,
    uploader_token: uploaderToken,
    created_at: now,
  });

  const response = NextResponse.json(
    { id: collectionId, name: collectionName, schematicIds },
    { status: 201 }
  );
  response.cookies.set('uploader_token', uploaderToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
