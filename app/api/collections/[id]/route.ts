import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import {
  getCollection,
  getCollectionSchematics,
  getCollectionImages,
  deleteCollection,
  deleteSchematic,
  deleteCollectionImage,
  insertSchematic,
  insertCollectionImage,
  updateSchematicMeta,
  updateCollectionMeta,
  setSchematicOrders,
  setCollectionImageOrders,
  setCollectionThumbnailImage,
} from '@/lib/db';
import { parseSchematicMeta } from '@/lib/schematic-parser';
import { generateThumbnail } from '@/lib/thumbnail';
import { logAction } from '@/lib/logger';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_THUMB_SIZE = 512 * 1024; // 512 KB
const MAX_TOTAL_PARTS = 70;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

function thumbsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'thumbs');
}

function collectionImagesDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'collection-images');
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
  const images = await getCollectionImages(id);

  return NextResponse.json({
    ...collection,
    images,
    schematics: schematics.map((s) => ({
      ...s,
      blockcodes: JSON.parse(s.blockcodes) as string[],
    })),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    logAction({ request, action: 'delete', resourceType: 'collection', resourceId: id, status: 'not_found' });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  const isAdmin = !!adminToken && uploaderToken === adminToken;

  if (!isAdmin && (!collection.uploader_token || collection.uploader_token !== uploaderToken)) {
    logAction({ request, action: 'delete', resourceType: 'collection', resourceId: id, status: 'forbidden' });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete all member schematics
  const schematics = await getCollectionSchematics(id);
  for (const s of schematics) {
    try { await fs.unlink(path.join(schematicsDir(), s.filename)); } catch { /* already gone */ }
    try { await fs.unlink(path.join(thumbsDir(), `${s.id}.png`)); } catch { /* no thumbnail */ }
    await deleteSchematic(s.id);
  }

  // Delete custom collection images
  const images = await getCollectionImages(id);
  const imgDir = collectionImagesDir();
  for (const img of images) {
    try { await fs.unlink(path.join(imgDir, `${img.id}.${img.ext}`)); } catch { /* already gone */ }
    await deleteCollectionImage(img.id);
  }

  await deleteCollection(id);
  logAction({
    request,
    action: 'delete',
    resourceType: 'collection',
    resourceId: id,
    voterToken: uploaderToken,
    details: { memberCount: schematics.length },
  });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  request: NextRequest,
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const name = (formData.get('name') as string | null)?.trim().slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
  }
  const description =
    (formData.get('description') as string | null)?.trim().slice(0, 1000) || null;

  // `order` is a JSON array of existing schematic IDs in the desired final order.
  // Any existing schematic not listed will be deleted.
  let orderIds: string[];
  try {
    const raw = formData.get('order') as string | null;
    orderIds = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return NextResponse.json({ error: 'Invalid order JSON' }, { status: 400 });
  }

  const existingSchematics = await getCollectionSchematics(id);
  const existingIdSet = new Set(existingSchematics.map((s) => s.id));

  // Validate all supplied IDs actually belong to this collection.
  for (const sid of orderIds) {
    if (!existingIdSet.has(sid)) {
      return NextResponse.json(
        { error: `Schematic ${sid} does not belong to this collection` },
        { status: 400 }
      );
    }
  }

  // Delete schematics not present in orderIds.
  const keepIds = new Set(orderIds);
  const toRemove = existingSchematics.filter((s) => !keepIds.has(s.id));
  for (const s of toRemove) {
    try { await fs.unlink(path.join(schematicsDir(), s.filename)); } catch { /* already gone */ }
    try { await fs.unlink(path.join(thumbsDir(), `${s.id}.png`)); } catch { /* no thumb */ }
    await deleteSchematic(s.id);
  }

  // Update metadata for remaining parts.
  for (const sid of orderIds) {
    const rawName = formData.get(`meta_${sid}_display_name`);
    const rawDesc = formData.get(`meta_${sid}_description`);
    if (rawName !== null || rawDesc !== null) {
      const original = existingSchematics.find((s) => s.id === sid)!;
      const display_name =
        typeof rawName === 'string'
          ? rawName.trim().slice(0, 120) || original.display_name || original.name
          : original.display_name || original.name;
      const partDescription =
        typeof rawDesc === 'string'
          ? rawDesc.trim().slice(0, 1000) || null
          : original.description;
      await updateSchematicMeta(sid, { display_name, description: partDescription });
    }
  }

  // Add new schematics.
  const newCount = parseInt((formData.get('new_count') as string | null) ?? '0', 10);
  const newIds: string[] = [];
  const schematicDir = schematicsDir();
  const tDir = thumbsDir();

  if (!isNaN(newCount) && newCount > 0) {
    await fs.mkdir(schematicDir, { recursive: true });
    await fs.mkdir(tDir, { recursive: true });

    for (let i = 0; i < newCount; i++) {
      // Hard cap on total parts.
      if (orderIds.length + newIds.length >= MAX_TOTAL_PARTS) break;

      const file = formData.get(`new_file_${i}`);
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_SIZE) continue;

      const xmlContent = await file.text();
      if (
        !xmlContent.includes('<PantographData') &&
        !xmlContent.includes('<pantographdata')
      ) continue;

      const meta = parseSchematicMeta(xmlContent);
      if (!meta.blockcodes.length) continue;

      const displayName =
        (formData.get(`new_display_name_${i}`) as string | null)?.trim().slice(0, 120) ||
        meta.name;
      const partDesc =
        (formData.get(`new_description_${i}`) as string | null)?.trim().slice(0, 1000) || null;

      const newId = uuidv4();
      const filename = `${newId}.xml`;
      await fs.writeFile(path.join(schematicDir, filename), xmlContent, 'utf-8');

      await insertSchematic({
        id: newId,
        name: meta.name,
        display_name: displayName,
        description: partDesc,
        filename,
        blockcodes: JSON.stringify(meta.blockcodes),
        cuboid_count: meta.cuboidCount,
        uploaded_at: Math.floor(Date.now() / 1000),
        uploader_token: collection.uploader_token ?? uploaderToken ?? '',
        download_count: 0,
        collection_id: id,
        collection_order: orderIds.length + newIds.length,
      });

      // Save thumbnail.
      try {
        const clientThumb = formData.get(`new_thumbnail_${i}`);
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
            await fs.writeFile(path.join(tDir, `${newId}.png`), thumbBuf);
          }
        } else {
          const thumbBuf = generateThumbnail(xmlContent);
          if (thumbBuf) await fs.writeFile(path.join(tDir, `${newId}.png`), thumbBuf);
        }
      } catch { /* thumbnail failure is non-fatal */ }

      newIds.push(newId);
    }
  }

  // Apply final collection_order.
  const finalOrder = [...orderIds, ...newIds];
  await setSchematicOrders(finalOrder.map((sid, idx) => ({ id: sid, collection_order: idx })));

  // ── Image management ────────────────────────────────────────────────────────

  const existingImages = await getCollectionImages(id);
  const imgDir = collectionImagesDir();

  // Remove images the client marked for deletion.
  let imgRemoveIds: string[] = [];
  try {
    const raw = formData.get('img_remove') as string | null;
    imgRemoveIds = raw ? (JSON.parse(raw) as string[]) : [];
  } catch { /* ignore bad JSON */ }

  const existingImageIdSet = new Set(existingImages.map((img) => img.id));
  for (const imgId of imgRemoveIds) {
    if (!existingImageIdSet.has(imgId)) continue;
    const img = existingImages.find((i) => i.id === imgId)!;
    try { await fs.unlink(path.join(imgDir, `${img.id}.${img.ext}`)); } catch { /* already gone */ }
    await deleteCollectionImage(imgId);
  }

  // Reorder remaining images.
  let imgOrder: string[] = [];
  try {
    const raw = formData.get('img_order') as string | null;
    imgOrder = raw ? (JSON.parse(raw) as string[]) : [];
  } catch { /* ignore */ }

  const removedSet = new Set(imgRemoveIds);
  const reorderItems = imgOrder
    .filter((imgId) => existingImageIdSet.has(imgId) && !removedSet.has(imgId))
    .map((imgId, idx) => ({ id: imgId, display_order: idx }));
  if (reorderItems.length > 0) {
    await setCollectionImageOrders(reorderItems);
  }

  // Add new images.
  const imgNewCount = parseInt((formData.get('img_new_count') as string | null) ?? '0', 10);
  const currentImageCount = existingImages.length - imgRemoveIds.filter((imgId) => existingImageIdSet.has(imgId)).length;
  if (!isNaN(imgNewCount) && imgNewCount > 0) {
    await fs.mkdir(imgDir, { recursive: true });
    const now = Math.floor(Date.now() / 1000);
    let addedCount = 0;
    for (let i = 0; i < imgNewCount && currentImageCount + addedCount < MAX_IMAGES; i++) {
      const imgFile = formData.get(`img_new_${i}`);
      if (!(imgFile instanceof File) || imgFile.size === 0 || imgFile.size > MAX_IMAGE_SIZE) continue;

      const imgBuf = Buffer.from(await imgFile.arrayBuffer());
      let ext: string | null = null;
      if (imgBuf.length >= PNG_MAGIC.length && imgBuf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        ext = 'png';
      } else if (imgBuf.length >= JPEG_MAGIC.length && imgBuf.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
        ext = 'jpg';
      }
      if (!ext) continue;

      const imgId = uuidv4();
      await fs.writeFile(path.join(imgDir, `${imgId}.${ext}`), imgBuf);
      await insertCollectionImage({
        id: imgId,
        collection_id: id,
        display_order: reorderItems.length + addedCount,
        ext,
        created_at: now,
      });
      addedCount++;
    }
  }

  // Update thumbnail selection.
  const thumbnailImageIdRaw = formData.get('thumbnail_image_id');
  if (thumbnailImageIdRaw !== null) {
    const thumbnailImageId = typeof thumbnailImageIdRaw === 'string' && thumbnailImageIdRaw.trim()
      ? thumbnailImageIdRaw.trim()
      : null;
    await setCollectionThumbnailImage(id, thumbnailImageId);
  }

  // ── Collection metadata ─────────────────────────────────────────────────────

  // Update collection metadata.
  await updateCollectionMeta(id, { name, description });

  logAction({
    request,
    action: 'edit',
    resourceType: 'collection',
    resourceId: id,
    voterToken: uploaderToken,
    details: {
      name,
      removedCount: toRemove.length,
      addedCount: newIds.length,
      totalParts: finalOrder.length,
    },
  });

  const updatedCollection = await getCollection(id);
  const updatedSchematics = await getCollectionSchematics(id);
  const updatedImages = await getCollectionImages(id);
  return NextResponse.json({
    ...updatedCollection,
    images: updatedImages,
    schematics: updatedSchematics.map((s) => ({
      ...s,
      blockcodes: JSON.parse(s.blockcodes) as string[],
    })),
  });
}
