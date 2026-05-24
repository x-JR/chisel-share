/**
 * Browser-side voxel decoder for Vintage Story QP Chisel (PantographData) schematics.
 *
 * Bit layout of each packed uint32 (Vintage Story BlockEntityMicroBlock.VoxelCuboids):
 *   bits  0– 3  x1  (0–15)
 *   bits  4– 7  y1  (0–15)
 *   bits  8–11  z1  (0–15)
 *   bits 12–15  x2  (0–15)
 *   bits 16–19  y2  (0–15)
 *   bits 20–23  z2  (0–15)
 *   bits 24–27  material index  (0–15)
 *
 * The voxeldata field is a protobuf repeated uint32 (field 1), base64-encoded.
 * Each record: 0x08 (tag) + varint bytes.
 */

export interface VoxelCuboid {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  matIdx: number;
}

export interface ParsedSchematic {
  name: string;
  blockcodes: string[];
  cuboids: VoxelCuboid[];
}

/** Decode a base64 string to a Uint8Array (browser). */
function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Unpack a single packed uint32 into a VoxelCuboid. */
export function unpackCuboid(packed: number): VoxelCuboid {
  return {
    x1: (packed >>> 0) & 0xf,
    y1: (packed >>> 4) & 0xf,
    z1: (packed >>> 8) & 0xf,
    x2: (packed >>> 12) & 0xf,
    y2: (packed >>> 16) & 0xf,
    z2: (packed >>> 20) & 0xf,
    matIdx: (packed >>> 24) & 0xf,
  };
}

/**
 * Decode a base64-encoded protobuf repeated uint32 field.
 * Protocol: each value is preceded by tag byte 0x08 (field 1, wire type 0).
 */
export function decodeVoxelData(b64: string): VoxelCuboid[] {
  const data = b64ToBytes(b64);
  const cuboids: VoxelCuboid[] = [];
  let i = 0;

  while (i < data.length) {
    if (data[i] !== 0x08) break; // unexpected tag — stop
    i++;

    // Decode varint (up to 5 bytes for a uint32)
    let value = 0;
    let shift = 0;
    while (i < data.length) {
      const byte = data[i++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if (!(byte & 0x80)) break;
    }

    cuboids.push(unpackCuboid(value >>> 0)); // >>> 0 ensures unsigned
  }

  return cuboids;
}

/** Parse a PantographData XML string and return the schematic data. */
export function parseSchematicXml(xmlString: string): ParsedSchematic {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const name = doc.querySelector('name')?.textContent?.trim() ?? 'Unnamed';

  const blockcodes: string[] = [];
  doc.querySelectorAll('blockcodes > string').forEach((el) => {
    const text = el.textContent?.trim();
    if (text) blockcodes.push(text);
  });

  const voxeldataB64 = doc.querySelector('voxeldata')?.textContent?.trim() ?? '';
  const cuboids = voxeldataB64 ? decodeVoxelData(voxeldataB64) : [];

  return { name, blockcodes, cuboids };
}
