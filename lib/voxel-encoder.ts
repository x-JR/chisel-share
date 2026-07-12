/**
 * Browser-side voxel encoder for Vintage Story QP Chisel (PantographData) schematics.
 * Inverse of the decoder in voxel-decoder.ts.
 *
 * Bit layout of each packed uint32 (mirrors unpackCuboid):
 *   bits  0– 3  x1
 *   bits  4– 7  y1
 *   bits  8–11  z1
 *   bits 12–15  x2
 *   bits 16–19  y2
 *   bits 20–23  z2
 *   bits 24–27  material index
 */

import type { VoxelCuboid } from './voxel-decoder';

/** Pack a VoxelCuboid back to an unsigned uint32. */
export function packCuboid(c: VoxelCuboid): number {
  return (
    (c.x1 & 0xf) |
    ((c.y1 & 0xf) << 4) |
    ((c.z1 & 0xf) << 8) |
    ((c.x2 & 0xf) << 12) |
    ((c.y2 & 0xf) << 16) |
    ((c.z2 & 0xf) << 20) |
    ((c.matIdx & 0xf) << 24)
  ) >>> 0; // force unsigned
}

/** Write a uint32 as a protobuf field-1 varint (tag 0x08 + varint bytes). */
function writeTaggedVarint(out: number[], value: number): void {
  out.push(0x08); // field 1, wire type 0
  let v = value >>> 0; // unsigned
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

/**
 * Encode cuboids to the base64 protobuf format used in the <voxeldata> field.
 * Produces output identical in structure to the original game files.
 */
export function encodeVoxelData(cuboids: VoxelCuboid[]): string {
  const bytes: number[] = [];
  for (const c of cuboids) writeTaggedVarint(bytes, packCuboid(c));
  const buf = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

/**
 * Rotate cuboids 90° clockwise around the Y axis (looking from above), applied
 * `steps` times (1 = 90° CW, 2 = 180°, 3 = 270° CW / 90° CCW).
 *
 * Transform per step: new_x = 15 − z2..z1,  new_z = x1..x2
 * Coordinates remain in [0, 15] and the x1 ≤ x2, z1 ≤ z2 invariant is preserved.
 */
export function rotateCuboidsY(cuboids: VoxelCuboid[], steps = 1): VoxelCuboid[] {
  const s = ((steps % 4) + 4) % 4; // normalise to 0–3
  let result = cuboids;
  for (let i = 0; i < s; i++) {
    result = result.map((c) => ({
      x1: 15 - c.z2,
      y1: c.y1,
      z1: c.x1,
      x2: 15 - c.z1,
      y2: c.y2,
      z2: c.x2,
      matIdx: c.matIdx,
    }));
  }
  return result;
}
