import { NextRequest, NextResponse } from 'next/server';
import { getSchematic } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAction, getClientIp } from '@/lib/logger';
import path from 'path';
import fs from 'fs/promises';

function schematicsDir(): string {
  const dataDir = process.env.DATA_DIR ?? process.cwd();
  return path.join(dataDir, 'data', 'schematics');
}

// Shared rate-limit bucket with the download endpoint
const VOXELS_LIMIT = 30;
const VOXELS_WINDOW_MS = 60_000;

interface Cuboid {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  mat: number;
}

function parseCuboids(xml: string): { blockcodes: string[]; cuboids: Cuboid[] } {
  // Extract blockcodes
  const codesBlock = xml.match(/<blockcodes>([\s\S]*?)<\/blockcodes>/)?.[1] ?? '';
  const blockcodes: string[] = [];
  const codeRe = /<string>([^<]*)<\/string>/g;
  let cm: RegExpExecArray | null;
  while ((cm = codeRe.exec(codesBlock)) !== null) {
    const bc = cm[1].trim();
    if (bc) blockcodes.push(bc);
  }

  // Extract and decode voxeldata (base64 protobuf repeated uint32)
  const raw = xml.match(/<voxeldata>([A-Za-z0-9+/=\s]+)<\/voxeldata>/)?.[1];
  if (!raw) return { blockcodes, cuboids: [] };
  const data = Buffer.from(raw.replace(/\s/g, ''), 'base64');

  const cuboids: Cuboid[] = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] !== 0x08) break;
    i++;
    // Decode varint
    let value = 0;
    let shift = 0;
    while (i < data.length) {
      const byte = data[i++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if (!(byte & 0x80)) break;
    }
    const p = value >>> 0;
    cuboids.push({
      x1: (p >>> 0) & 0xf,
      y1: (p >>> 4) & 0xf,
      z1: (p >>> 8) & 0xf,
      x2: (p >>> 12) & 0xf,
      y2: (p >>> 16) & 0xf,
      z2: (p >>> 20) & 0xf,
      mat: (p >>> 24) & 0xf,
    });
  }
  return { blockcodes, cuboids };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, 'download', VOXELS_LIMIT, VOXELS_WINDOW_MS);
  if (!rl.allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
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

  const { blockcodes, cuboids } = parseCuboids(xmlContent);

  return NextResponse.json({ blockcodes, cuboids });
}
