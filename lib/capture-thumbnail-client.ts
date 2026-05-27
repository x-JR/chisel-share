'use client';

/**
 * Renders a QP Chisel schematic into an offscreen Three.js canvas and returns
 * the result as a PNG Blob.  Call this only in browser contexts.
 */

import * as THREE from 'three';
import { parseSchematicXml } from './voxel-decoder';
import { resolveTexture } from './texture-resolver';

const THUMB_W = 512;
const THUMB_H = 384;

export async function captureThumbnail(xmlContent: string): Promise<Blob | null> {
  try {
    const schematic = parseSchematicXml(xmlContent);
    if (!schematic.cuboids.length) return null;

    // Compute bounding box in voxel space
    let minX = 16, minY = 16, minZ = 16;
    let maxX = 0,  maxY = 0,  maxZ = 0;
    for (const c of schematic.cuboids) {
      minX = Math.min(minX, c.x1); minY = Math.min(minY, c.y1); minZ = Math.min(minZ, c.z1);
      maxX = Math.max(maxX, c.x2); maxY = Math.max(maxY, c.y2); maxZ = Math.max(maxZ, c.z2);
    }

    const V = 1 / 16; // one voxel unit in world coords
    const cx = ((minX + maxX + 1) / 2) * V;
    const cy = ((minY + maxY + 1) / 2) * V;
    const cz = ((minZ + maxZ + 1) / 2) * V;
    const span = Math.max(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1) * V;

    // Offscreen canvas — never attached to the DOM
    const canvas = document.createElement('canvas');
    canvas.width  = THUMB_W;
    canvas.height = THUMB_H;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(THUMB_W, THUMB_H);
    renderer.setPixelRatio(1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Camera — same angle as the interactive viewer
    const camera = new THREE.PerspectiveCamera(45, THUMB_W / THUMB_H, 0.001, 200);
    camera.position.set(cx + span * 1.6, cy + span * 1.3, cz + span * 1.6);
    camera.lookAt(cx, cy, cz);

    // Lighting — matches the viewer
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(1, 2, 1.5);
    scene.add(sun);

    // Texture & material caches
    const loader   = new THREE.TextureLoader();
    const texCache = new Map<number, THREE.Texture | null>();
    const matCache = new Map<number, THREE.MeshLambertMaterial>();

    async function getTexture(matIdx: number): Promise<THREE.Texture | null> {
      if (texCache.has(matIdx)) return texCache.get(matIdx) ?? null;
      const url = resolveTexture(schematic.blockcodes[matIdx] ?? '');
      if (!url) { texCache.set(matIdx, null); return null; }
      return new Promise((resolve) => {
        loader.load(
          url,
          (tex) => {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            texCache.set(matIdx, tex);
            resolve(tex);
          },
          undefined,
          () => { texCache.set(matIdx, null); resolve(null); },
        );
      });
    }

    async function getMaterial(matIdx: number): Promise<THREE.MeshLambertMaterial> {
      if (matCache.has(matIdx)) return matCache.get(matIdx)!;
      const tex = await getTexture(matIdx);
      const blockcode = schematic.blockcodes[matIdx] ?? '';
      const isGlow = blockcode.startsWith('game:creativeglow-');
      let mat: THREE.MeshLambertMaterial;
      if (tex) {
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          ...(isGlow && { emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.7 }),
        });
      } else {
        const blockcode = schematic.blockcodes[matIdx] ?? '';
        const isGlow = blockcode.includes('creativeglow');
        mat = new THREE.MeshLambertMaterial({
          color: isGlow
            ? 0xffe066
            : new THREE.Color().setHSL((matIdx * 0.382) % 1, 0.55, 0.5),
          emissive:          isGlow ? new THREE.Color(0xffaa00) : new THREE.Color(0),
          emissiveIntensity: isGlow ? 0.5 : 0,
        });
      }
      matCache.set(matIdx, mat);
      return mat;
    }

    // Build scene meshes
    for (const c of schematic.cuboids) {
      const cw = (c.x2 - c.x1 + 1) * V;
      const ch = (c.y2 - c.y1 + 1) * V;
      const cd = (c.z2 - c.z1 + 1) * V;
      const geo = new THREE.BoxGeometry(cw, ch, cd);

      // World-space UV mapping — same logic as SchematicViewer
      const meshPX = ((c.x1 + c.x2 + 1) / 2) * V;
      const meshPY = ((c.y1 + c.y2 + 1) / 2) * V;
      const meshPZ = ((c.z1 + c.z2 + 1) / 2) * V;
      const posAttr = geo.attributes.position;
      const norAttr = geo.attributes.normal;
      const uvAttr  = geo.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        const nx = norAttr.getX(i);
        const ny = norAttr.getY(i);
        const wx = posAttr.getX(i) + meshPX;
        const wy = posAttr.getY(i) + meshPY;
        const wz = posAttr.getZ(i) + meshPZ;
        let u: number, v: number;
        if (Math.abs(nx) > 0.5)      { u = wz; v = wy; }  // ±X face
        else if (Math.abs(ny) > 0.5) { u = wx; v = wz; }  // ±Y face
        else                         { u = wx; v = wy; }  // ±Z face
        uvAttr.setXY(i, u, v);
      }
      uvAttr.needsUpdate = true;

      const mat = await getMaterial(c.matIdx);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(meshPX, meshPY, meshPZ);
      scene.add(mesh);
    }

    // Render a single frame
    renderer.render(scene, camera);

    // Capture and clean up
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );

    renderer.dispose();
    renderer.forceContextLoss();
    texCache.forEach((t) => t?.dispose());
    matCache.forEach((m) => m.dispose());

    return blob;
  } catch {
    return null;
  }
}
