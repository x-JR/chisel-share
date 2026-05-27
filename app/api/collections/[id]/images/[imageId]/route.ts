import { NextRequest, NextResponse } from 'next/server';
import { getCollectionImages } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectionImagesDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'collection-images');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(imageId)) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify the image actually belongs to this collection
  const images = await getCollectionImages(id);
  const image = images.find((img) => img.id === imageId);
  if (!image) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const filePath = path.join(collectionImagesDir(), `${imageId}.${image.ext}`);
    const data = await fs.readFile(filePath);
    const contentType = image.ext === 'png' ? 'image/png' : 'image/jpeg';
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
