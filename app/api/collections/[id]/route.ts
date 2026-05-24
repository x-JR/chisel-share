import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getCollection,
  getCollectionSchematics,
  deleteCollection,
  deleteSchematic,
} from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

function thumbsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'thumbs');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const schematics = await getCollectionSchematics(id);

  return NextResponse.json({
    ...collection,
    schematics: schematics.map((s) => ({
      ...s,
      blockcodes: JSON.parse(s.blockcodes) as string[],
    })),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;

  if (!isAdmin && (!collection.uploader_token || collection.uploader_token !== uploaderToken)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete all member schematics
  const schematics = await getCollectionSchematics(id);
  for (const s of schematics) {
    try { await fs.unlink(path.join(schematicsDir(), s.filename)); } catch { /* already gone */ }
    try { await fs.unlink(path.join(thumbsDir(), `${s.id}.png`)); } catch { /* no thumbnail */ }
    await deleteSchematic(s.id);
  }

  await deleteCollection(id);
  return new NextResponse(null, { status: 204 });
}
