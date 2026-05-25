import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSchematic, deleteSchematic, updateSchematicMeta } from '@/lib/db';
import { logAction } from '@/lib/logger';
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
  const record = await getSchematic(id);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let xmlContent: string;
  try {
    xmlContent = await fs.readFile(
      path.join(schematicsDir(), record.filename),
      'utf-8'
    );
  } catch {
    return NextResponse.json(
      { error: 'Schematic file missing from disk' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...record,
    blockcodes: JSON.parse(record.blockcodes) as string[],
    xmlContent,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record2 = await getSchematic(id);
  if (!record2) {
    logAction({ request, action: 'delete', resourceType: 'schematic', resourceId: id, status: 'not_found' });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = adminToken && uploaderToken === adminToken;
  if (!isAdmin && (!record2.uploader_token || record2.uploader_token !== uploaderToken)) {
    logAction({ request, action: 'delete', resourceType: 'schematic', resourceId: id, status: 'forbidden' });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await fs.unlink(path.join(schematicsDir(), record2.filename));
  } catch {
    // File already gone — continue
  }

  try {
    await fs.unlink(path.join(thumbsDir(), `${id}.png`));
  } catch {
    // No thumbnail — that's fine
  }

  await deleteSchematic(id);
  logAction({
    request,
    action: 'delete',
    resourceType: 'schematic',
    resourceId: id,
    voterToken: uploaderToken,
  });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;
  if (!isAdmin && (!record.uploader_token || record.uploader_token !== uploaderToken)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { display_name?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const display_name =
    typeof body.display_name === 'string'
      ? body.display_name.trim().slice(0, 120)
      : (record.display_name ?? record.name);
  const description =
    typeof body.description === 'string'
      ? body.description.trim().slice(0, 1000) || null
      : record.description;

  if (!display_name) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
  }

  await updateSchematicMeta(id, { display_name, description });

  logAction({
    request,
    action: 'edit',
    resourceType: 'schematic',
    resourceId: id,
    voterToken: uploaderToken,
    details: { display_name },
  });

  const updated = await getSchematic(id);
  return NextResponse.json({
    ...updated,
    blockcodes: JSON.parse(updated!.blockcodes) as string[],
  });
}
