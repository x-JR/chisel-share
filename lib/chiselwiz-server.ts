/**
 * Server-side Chisel Wiz format support.
 *
 * Chisel Wiz catalogue format (JSON):
 *   { version: 1, designs: [{ name, dateAdded, blueprintData: { name, voxels, materials, materialCodes[] } }] }
 *
 * voxels  — gzip → 512 bytes bit-packed, index = x*256 + y*16 + z, 1 = voxel present
 * materials — gzip → 4096 bytes, index = x*256 + y*16 + z, byte = material slot index (0-indexed into materialCodes)
 */

import zlib from 'zlib';
import type { SchematicMeta } from './schematic-parser';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface VoxelCuboid {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  matIdx: number;
}

interface BlueprintData {
  name: string;
  voxels: string;
  materials: string;
  materialCodes: string[];
}

interface ChiselWizDesign {
  name: string;
  dateAdded?: string;
  blueprintData: BlueprintData;
}

export interface ChiselWizFile {
  version: number;
  designs: ChiselWizDesign[];
}

// ---------------------------------------------------------------------------
// Voxel grid helpers
// ---------------------------------------------------------------------------

function gunzip(b64: string): Buffer {
  return zlib.gunzipSync(Buffer.from(b64.replace(/\s/g, ''), 'base64'));
}

function getBit(buf: Buffer, i: number): number {
  return (buf[i >> 3] >> (i & 7)) & 1;
}

/** Greedy meshing: voxel bit-grid + per-voxel material bytes → minimal cuboid list. */
function greedyMesh(voxBuf: Buffer, matBuf: Buffer): VoxelCuboid[] {
  const getV = (x: number, y: number, z: number) =>
    getBit(voxBuf, x * 256 + y * 16 + z) === 1;
  const getM = (x: number, y: number, z: number) =>
    matBuf[x * 256 + y * 16 + z];

  const visited = new Uint8Array(4096);
  const cuboids: VoxelCuboid[] = [];

  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      for (let z = 0; z < 16; z++) {
        if (!getV(x, y, z) || visited[x * 256 + y * 16 + z]) continue;
        const m = getM(x, y, z);

        // Expand along x
        let x2 = x;
        while (
          x2 + 1 < 16 &&
          getV(x2 + 1, y, z) &&
          !visited[(x2 + 1) * 256 + y * 16 + z] &&
          getM(x2 + 1, y, z) === m
        ) x2++;

        // Expand along y
        let y2 = y;
        expandY: while (y2 + 1 < 16) {
          for (let xi = x; xi <= x2; xi++) {
            if (
              !getV(xi, y2 + 1, z) ||
              visited[xi * 256 + (y2 + 1) * 16 + z] ||
              getM(xi, y2 + 1, z) !== m
            ) break expandY;
          }
          y2++;
        }

        // Expand along z
        let z2 = z;
        expandZ: while (z2 + 1 < 16) {
          for (let xi = x; xi <= x2; xi++) {
            for (let yi = y; yi <= y2; yi++) {
              if (
                !getV(xi, yi, z2 + 1) ||
                visited[xi * 256 + yi * 16 + (z2 + 1)] ||
                getM(xi, yi, z2 + 1) !== m
              ) break expandZ;
            }
          }
          z2++;
        }

        // Mark visited
        for (let xi = x; xi <= x2; xi++)
          for (let yi = y; yi <= y2; yi++)
            for (let zi = z; zi <= z2; zi++)
              visited[xi * 256 + yi * 16 + zi] = 1;

        cuboids.push({ x1: x, y1: y, z1: z, x2, y2, z2, matIdx: m });
      }
    }
  }

  return cuboids;
}

/** Expand cuboids back into a 16×16×16 voxel bit-grid and material byte-grid. */
function cuboidsToVoxelGrids(
  cuboids: VoxelCuboid[]
): { voxBuf: Buffer; matBuf: Buffer } {
  const voxArr = new Uint8Array(512);  // bit-packed
  const matArr = new Uint8Array(4096); // one byte per voxel

  for (const c of cuboids) {
    for (let x = c.x1; x <= c.x2; x++) {
      for (let y = c.y1; y <= c.y2; y++) {
        for (let z = c.z1; z <= c.z2; z++) {
          const idx = x * 256 + y * 16 + z;
          voxArr[idx >> 3] |= 1 << (idx & 7);
          matArr[idx] = c.matIdx;
        }
      }
    }
  }

  return { voxBuf: Buffer.from(voxArr), matBuf: Buffer.from(matArr) };
}

// ---------------------------------------------------------------------------
// Protobuf encode (packed uint32 repeated field, same as QP Chisel voxeldata)
// ---------------------------------------------------------------------------

function packCuboid(c: VoxelCuboid): number {
  return (
    (c.x1 & 0xf) |
    ((c.y1 & 0xf) << 4) |
    ((c.z1 & 0xf) << 8) |
    ((c.x2 & 0xf) << 12) |
    ((c.y2 & 0xf) << 16) |
    ((c.z2 & 0xf) << 20) |
    ((c.matIdx & 0xf) << 24)
  );
}

function encodeVarint(value: number): number[] {
  value >>>= 0;
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return bytes;
}

function encodeCuboidsToProtobufB64(cuboids: VoxelCuboid[]): string {
  const bytes: number[] = [];
  for (const c of cuboids) {
    bytes.push(0x08); // field 1, wire type 0
    bytes.push(...encodeVarint(packCuboid(c)));
  }
  return Buffer.from(bytes).toString('base64');
}

// ---------------------------------------------------------------------------
// Server-side XML parse helpers (mirrors schematic-parser.ts, but returns cuboids)
// ---------------------------------------------------------------------------

function extractXmlField(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]*)\\s*</${tag}>`));
  return match ? match[1].trim() : null;
}

function extractXmlStrings(xml: string, parent: string): string[] {
  const parentMatch = xml.match(
    new RegExp(`<${parent}[^>]*>([\\s\\S]*?)</${parent}>`)
  );
  if (!parentMatch) return [];
  return [...parentMatch[1].matchAll(/<string>([^<]*)<\/string>/g)].map(
    (m) => m[1].trim()
  );
}

function decodeProtobufCuboids(b64: string): VoxelCuboid[] {
  const data = Buffer.from(b64.replace(/\s/g, ''), 'base64');
  const cuboids: VoxelCuboid[] = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] !== 0x08) break;
    i++;
    let value = 0;
    let shift = 0;
    while (i < data.length) {
      const byte = data[i++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if (!(byte & 0x80)) break;
    }
    const packed = value >>> 0;
    cuboids.push({
      x1: (packed >>> 0) & 0xf,
      y1: (packed >>> 4) & 0xf,
      z1: (packed >>> 8) & 0xf,
      x2: (packed >>> 12) & 0xf,
      y2: (packed >>> 16) & 0xf,
      z2: (packed >>> 20) & 0xf,
      matIdx: (packed >>> 24) & 0xf,
    });
  }
  return cuboids;
}

// ---------------------------------------------------------------------------
// XML builder
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildPantographXml(
  name: string,
  blockcodes: string[],
  voxeldataB64: string
): string {
  const codes = blockcodes
    .map((c) => `    <string>${escapeXml(c)}</string>`)
    .join('\n');
  return [
    '<PantographData>',
    `  <name>${escapeXml(name)}</name>`,
    `  <voxeldata>${voxeldataB64}</voxeldata>`,
    '  <matdata></matdata>',
    '  <blockcodes>',
    codes,
    '  </blockcodes>',
    '</PantographData>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Detect whether a string is a Chisel Wiz JSON catalogue. */
export function isChiselWizJson(content: string): boolean {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('{')) return false;
  try {
    const data = JSON.parse(content);
    return (
      typeof data === 'object' &&
      Array.isArray(data.designs) &&
      data.designs.length > 0 &&
      typeof data.designs[0]?.blueprintData?.materialCodes !== 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * Parse a Chisel Wiz JSON catalogue and return metadata about the first design.
 * Throws if the format is invalid.
 */
export function parseChiselWizMeta(jsonText: string): SchematicMeta {
  const data: ChiselWizFile = JSON.parse(jsonText);
  const design = data?.designs?.[0];
  if (!design?.blueprintData) throw new Error('Invalid Chisel Wiz format');

  const bp = design.blueprintData;
  const name = design.name || bp.name || 'Unnamed';
  const blockcodes: string[] = bp.materialCodes ?? [];

  const voxBuf = gunzip(bp.voxels);
  const matBuf = gunzip(bp.materials);
  const cuboids = greedyMesh(voxBuf, matBuf);

  return { name, blockcodes, cuboidCount: cuboids.length };
}

/**
 * Convert a Chisel Wiz JSON catalogue to a PantographData XML string (first design only).
 * Returns the XML and parsed metadata.
 */
export function convertChiselWizToXml(jsonText: string): {
  xml: string;
  meta: SchematicMeta;
} {
  const data: ChiselWizFile = JSON.parse(jsonText);
  const design = data?.designs?.[0];
  if (!design?.blueprintData) throw new Error('Invalid Chisel Wiz format');

  const bp = design.blueprintData;
  const name = design.name || bp.name || 'Unnamed';
  const blockcodes: string[] = bp.materialCodes ?? [];

  const voxBuf = gunzip(bp.voxels);
  const matBuf = gunzip(bp.materials);
  const cuboids = greedyMesh(voxBuf, matBuf);
  const voxeldataB64 = encodeCuboidsToProtobufB64(cuboids);
  const xml = buildPantographXml(name, blockcodes, voxeldataB64);

  return { xml, meta: { name, blockcodes, cuboidCount: cuboids.length } };
}

/**
 * Convert a stored PantographData XML to a Chisel Wiz JSON catalogue string.
 * Used when the user requests download in Chisel Wiz format.
 */
export function convertXmlToChiselWiz(
  xmlContent: string,
  displayName?: string
): string {
  const name = displayName || extractXmlField(xmlContent, 'name') || 'Unnamed';
  const blockcodes = extractXmlStrings(xmlContent, 'blockcodes');
  const voxeldataB64 = extractXmlField(xmlContent, 'voxeldata') ?? '';

  const cuboids = voxeldataB64 ? decodeProtobufCuboids(voxeldataB64) : [];
  const { voxBuf, matBuf } = cuboidsToVoxelGrids(cuboids);

  const compressedVox = zlib.gzipSync(voxBuf).toString('base64');
  const compressedMat = zlib.gzipSync(matBuf).toString('base64');

  const catalogue: ChiselWizFile = {
    version: 1,
    designs: [
      {
        name,
        dateAdded: new Date().toISOString(),
        blueprintData: {
          name: '',
          voxels: compressedVox,
          materials: compressedMat,
          materialCodes: blockcodes,
        },
      },
    ],
  };

  return JSON.stringify(catalogue, null, 2);
}
