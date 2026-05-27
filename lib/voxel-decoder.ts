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

// ---------------------------------------------------------------------------
// Chisel Wiz JSON browser-side parser
// ---------------------------------------------------------------------------

/** Decompress a gzip+base64 string in the browser using DecompressionStream. */
async function gunzipBrowser(b64: string): Promise<Uint8Array> {
  const compressed = b64ToBytes(b64.replace(/\s/g, ''));
  // Ensure a clean ArrayBuffer (no SharedArrayBuffer) for DecompressionStream
  const buf = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength
  ) as ArrayBuffer;
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(buf);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Greedy meshing: convert a Chisel Wiz voxel bit-grid + material grid to cuboids. */
function greedyMeshBrowser(
  voxBuf: Uint8Array,
  matBuf: Uint8Array
): VoxelCuboid[] {
  const getV = (x: number, y: number, z: number) =>
    ((voxBuf[(x * 256 + y * 16 + z) >> 3] >> ((x * 256 + y * 16 + z) & 7)) & 1) === 1;
  const getM = (x: number, y: number, z: number) => matBuf[x * 256 + y * 16 + z];

  const visited = new Uint8Array(4096);
  const cuboids: VoxelCuboid[] = [];

  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      for (let z = 0; z < 16; z++) {
        if (!getV(x, y, z) || visited[x * 256 + y * 16 + z]) continue;
        const m = getM(x, y, z);

        let x2 = x;
        while (
          x2 + 1 < 16 &&
          getV(x2 + 1, y, z) &&
          !visited[(x2 + 1) * 256 + y * 16 + z] &&
          getM(x2 + 1, y, z) === m
        ) x2++;

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

/**
 * Parse a Chisel Wiz JSON catalogue (first design) in the browser.
 * Returns the same ParsedSchematic shape as parseSchematicXml.
 */
export async function parseChiselWizJson(jsonText: string): Promise<ParsedSchematic> {
  const data = JSON.parse(jsonText);
  const design = data?.designs?.[0];
  if (!design?.blueprintData) throw new Error('Invalid Chisel Wiz format');

  const bp = design.blueprintData;
  const name: string = design.name || bp.name || 'Unnamed';
  const blockcodes: string[] = bp.materialCodes ?? [];

  const voxBuf = await gunzipBrowser(bp.voxels);
  const matBuf = await gunzipBrowser(bp.materials);
  const cuboids = greedyMeshBrowser(voxBuf, matBuf);

  return { name, blockcodes, cuboids };
}

/** Returns true if the string looks like a Chisel Wiz JSON catalogue. */
export function isChiselWizContent(content: string): boolean {
  return content.trimStart().startsWith('{');
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
