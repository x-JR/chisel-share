import { createCanvas } from '@napi-rs/canvas';
import { blockcodeToColor } from './texture-resolver';

interface Cuboid {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  matIdx: number;
}

const CANVAS_W = 256;
const CANVAS_H = 192;
const PAD = 18;
const BG = '#0f172a';
const OUTLINE = 'rgba(0,0,0,0.35)';

function parseCuboids(xml: string): { cuboids: Cuboid[]; blockcodes: string[] } {
  // Blockcodes
  const codesBlock = xml.match(/<blockcodes>([\s\S]*?)<\/blockcodes>/)?.[1] ?? '';
  const blockcodes: string[] = [];
  const codeRe = /<string>([^<]*)<\/string>/g;
  let cm: RegExpExecArray | null;
  while ((cm = codeRe.exec(codesBlock)) !== null) {
    const bc = cm[1].trim();
    if (bc) blockcodes.push(bc);
  }

  // Voxeldata
  const raw = xml.match(/<voxeldata>([A-Za-z0-9+/=\s]+)<\/voxeldata>/)?.[1];
  if (!raw) return { cuboids: [], blockcodes };
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
      matIdx: (p >>> 24) & 0xf,
    });
  }
  return { cuboids, blockcodes };
}

function shade(hex: string, factor: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `rgb(${r},${g},${b})`;
}

/**
 * Generates a 256×192 isometric PNG thumbnail of a QP Chisel schematic.
 * Returns null if the XML contains no voxel data.
 */
export function generateThumbnail(xml: string): Buffer | null {
  try {
    const { cuboids, blockcodes } = parseCuboids(xml);
    if (cuboids.length === 0) return null;

    const matColors = blockcodes.map(blockcodeToColor);

    // Compute bounding box (coords are 0-15; +1 to get exclusive upper bound)
    let maxX = 1, maxY = 1, maxZ = 1;
    for (const c of cuboids) {
      maxX = Math.max(maxX, c.x2 + 1);
      maxY = Math.max(maxY, c.y2 + 1);
      maxZ = Math.max(maxZ, c.z2 + 1);
    }

    // Tile dimensions — scale to fit content in the canvas
    const usableW = CANVAS_W - PAD * 2;
    const usableH = CANVAS_H - PAD * 2;
    const sc = Math.min(
      usableW / ((maxX + maxZ) * 16),
      usableH / ((maxX + maxZ) * 8 + maxY * 16),
    );
    const TW = 16 * sc;  // screen half-width per 1 voxel unit in X or Z
    const TH = 8 * sc;   // screen half-height per 1 voxel unit in X or Z
    const YH = 16 * sc;  // screen height per 1 voxel unit in Y

    // Origin = screen position of voxel (0,0,0)
    // Centered horizontally; top-padded with room for the Y extent
    const originX = CANVAS_W / 2 + (maxZ - maxX) * TW / 2;
    const originY = PAD + maxY * YH;

    function proj(x: number, y: number, z: number) {
      return {
        sx: originX + (x - z) * TW,
        sy: originY + (x + z) * TH - y * YH,
      };
    }

    // Painter's algorithm: far cuboids first
    // "Far" = high (z-x) value; break ties with lower y first
    const sorted = [...cuboids].sort((a, b) => {
      const dA = (a.z1 + a.z2) - (a.x1 + a.x2);
      const dB = (b.z1 + b.z2) - (b.x1 + b.x2);
      return dB !== dA ? dB - dA : (a.y1 + a.y2) - (b.y1 + b.y2);
    });

    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    function quad(
      p1: { sx: number; sy: number },
      p2: { sx: number; sy: number },
      p3: { sx: number; sy: number },
      p4: { sx: number; sy: number },
      fill: string,
    ) {
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.lineTo(p3.sx, p3.sy);
      ctx.lineTo(p4.sx, p4.sy);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    for (const c of sorted) {
      const base = c.matIdx < matColors.length ? matColors[c.matIdx] : '#888888';

      // Top face (y = y2): brightest
      quad(
        proj(c.x1, c.y2, c.z1), proj(c.x2, c.y2, c.z1),
        proj(c.x2, c.y2, c.z2), proj(c.x1, c.y2, c.z2),
        shade(base, 1.35),
      );

      // Right screen face (z = z1): medium
      quad(
        proj(c.x1, c.y1, c.z1), proj(c.x2, c.y1, c.z1),
        proj(c.x2, c.y2, c.z1), proj(c.x1, c.y2, c.z1),
        shade(base, 0.9),
      );

      // Left screen face (x = x2): darkest
      quad(
        proj(c.x2, c.y1, c.z1), proj(c.x2, c.y1, c.z2),
        proj(c.x2, c.y2, c.z2), proj(c.x2, c.y2, c.z1),
        shade(base, 0.7),
      );
    }

    return canvas.toBuffer('image/png') as unknown as Buffer;
  } catch {
    return null;
  }
}
