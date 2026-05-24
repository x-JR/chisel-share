/**
 * Server-side schematic XML parser.
 * Extracts metadata from PantographData XML using lightweight string matching.
 * Uses Buffer (Node.js) for base64 decoding — server-only.
 */

export interface SchematicMeta {
  name: string;
  blockcodes: string[];
  cuboidCount: number;
}

/** Extract the text content of the first matching XML element. */
function extractField(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]*)\\s*</${tag}>`));
  return match ? match[1].trim() : null;
}

/** Extract all <string> elements within a given parent element. */
function extractStrings(xml: string, parent: string): string[] {
  const parentMatch = xml.match(
    new RegExp(`<${parent}[^>]*>([\\s\\S]*?)</${parent}>`)
  );
  if (!parentMatch) return [];
  return [...parentMatch[1].matchAll(/<string>([^<]*)<\/string>/g)].map(
    (m) => m[1].trim()
  );
}

/**
 * Count the number of protobuf uint32 values in a repeated field.
 * Each value is encoded as tag byte 0x08 followed by a varint.
 */
function countProtobufUint32(data: Uint8Array): number {
  let count = 0;
  let i = 0;
  while (i < data.length) {
    if (data[i] !== 0x08) break;
    i++;
    // Skip varint bytes
    while (i < data.length) {
      const done = !(data[i] & 0x80);
      i++;
      if (done) break;
    }
    count++;
  }
  return count;
}

export function parseSchematicMeta(xmlContent: string): SchematicMeta {
  const name = extractField(xmlContent, 'name') ?? 'Unnamed Schematic';
  const blockcodes = extractStrings(xmlContent, 'blockcodes');

  const voxeldataB64 = extractField(xmlContent, 'voxeldata') ?? '';
  let cuboidCount = 0;
  if (voxeldataB64) {
    try {
      const bytes = Buffer.from(voxeldataB64.replace(/\s/g, ''), 'base64');
      cuboidCount = countProtobufUint32(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    } catch {
      cuboidCount = 0;
    }
  }

  return { name, blockcodes, cuboidCount };
}
