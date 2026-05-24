import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const TEXTURE_BASE = path.resolve(
  path.join(process.env.DATA_DIR ?? process.cwd(), 'textures')
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Each segment: only alphanumeric, hyphens, underscores; last must end with .png
  for (const seg of segments) {
    if (!/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/.test(seg)) {
      return new NextResponse('Not found', { status: 404 });
    }
  }

  const lastSeg = segments[segments.length - 1];
  if (!lastSeg.endsWith('.png')) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Build and validate the absolute path to prevent directory traversal
  const absolutePath = path.join(TEXTURE_BASE, ...segments);
  const normalised = path.resolve(absolutePath);
  if (!normalised.startsWith(TEXTURE_BASE + path.sep) && normalised !== TEXTURE_BASE) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const data = await fs.readFile(normalised);
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
