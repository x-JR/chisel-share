'use client';

import { useEffect, useRef } from 'react';
import type * as THREE from 'three';

interface Props {
  xmlContent: string;
  className?: string;
}

export default function SchematicViewer({ xmlContent, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !xmlContent) return;

    const container = containerRef.current;
    let animationId: number;
    let isMounted = true;
    let disposeAll: (() => void) | undefined;

    async function init() {
      const THREE = await import('three');
      const { OrbitControls } = await import(
        'three/examples/jsm/controls/OrbitControls.js'
      );
      const { parseSchematicXml } = await import('@/lib/voxel-decoder');
      const { resolveTexture } = await import('@/lib/texture-resolver');

      if (!isMounted) return;

      const schematic = parseSchematicXml(xmlContent);
      if (!schematic.cuboids.length) return;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 400;
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      // Compute bounding box in voxel space
      let minX = 16, minY = 16, minZ = 16;
      let maxX = 0, maxY = 0, maxZ = 0;
      for (const c of schematic.cuboids) {
        minX = Math.min(minX, c.x1);
        minY = Math.min(minY, c.y1);
        minZ = Math.min(minZ, c.z1);
        maxX = Math.max(maxX, c.x2);
        maxY = Math.max(maxY, c.y2);
        maxZ = Math.max(maxZ, c.z2);
      }
      const V = 1 / 16; // one voxel in world units
      const cx = ((minX + maxX) / 2) * V;
      const cy = ((minY + maxY) / 2) * V;
      const cz = ((minZ + maxZ) / 2) * V;
      const span = Math.max(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1) * V;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 200);
      camera.position.set(cx + span * 1.6, cy + span * 1.3, cz + span * 1.6);
      camera.lookAt(cx, cy, cz);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(1, 2, 1.5);
      scene.add(sun);

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(cx, cy, cz);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      // Texture loader + cache
      const loader = new THREE.TextureLoader();
      const texCache = new Map<number, THREE.Texture | null>();

      async function getTexture(matIdx: number): Promise<THREE.Texture | null> {
        if (texCache.has(matIdx)) return texCache.get(matIdx) ?? null;
        const url = resolveTexture(schematic.blockcodes[matIdx] ?? '');
        if (!url) {
          texCache.set(matIdx, null);
          return null;
        }
        return new Promise((resolve) => {
          loader.load(
            url,
            (tex) => {
              tex.magFilter = THREE.NearestFilter;
              tex.minFilter = THREE.NearestFilter;
              texCache.set(matIdx, tex);
              resolve(tex);
            },
            undefined,
            () => {
              texCache.set(matIdx, null);
              resolve(null);
            }
          );
        });
      }

      // Material cache (share material objects between cuboids with the same matIdx)
      const matCache = new Map<number, THREE.MeshLambertMaterial>();

      async function getMaterial(matIdx: number): Promise<THREE.MeshLambertMaterial> {
        if (matCache.has(matIdx)) return matCache.get(matIdx)!;

        const tex = await getTexture(matIdx);
        let mat: THREE.MeshLambertMaterial;

        if (tex) {
          mat = new THREE.MeshLambertMaterial({ map: tex });
        } else {
          const blockcode = schematic.blockcodes[matIdx] ?? '';
          const isGlow = blockcode.includes('creativeglow');
          mat = new THREE.MeshLambertMaterial({
            color: isGlow ? 0xffe066 : new THREE.Color().setHSL((matIdx * 0.382) % 1, 0.55, 0.5),
            emissive: isGlow ? new THREE.Color(0xffaa00) : new THREE.Color(0),
            emissiveIntensity: isGlow ? 0.5 : 0,
          });
        }

        matCache.set(matIdx, mat);
        return mat;
      }

      // Build mesh for each cuboid
      for (const c of schematic.cuboids) {
        const cw = (c.x2 - c.x1 + 1) * V;
        const ch = (c.y2 - c.y1 + 1) * V;
        const cd = (c.z2 - c.z1 + 1) * V;
        const geo = new THREE.BoxGeometry(cw, ch, cd);
        const mat = await getMaterial(c.matIdx);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          ((c.x1 + c.x2) / 2) * V,
          ((c.y1 + c.y2) / 2) * V,
          ((c.z1 + c.z2) / 2) * V
        );
        scene.add(mesh);
      }

      // Grid helper at the base of the voxel space
      const grid = new THREE.GridHelper(1, 16, 0x555566, 0x333344);
      grid.position.set(0.5 - V * 0.5, 0, 0.5 - V * 0.5);
      scene.add(grid);

      // Animation loop
      function animate() {
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      // Responsive resize
      const resizeObs = new ResizeObserver(() => {
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        if (nw > 0 && nh > 0) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      });
      resizeObs.observe(container);

      disposeAll = () => {
        cancelAnimationFrame(animationId);
        resizeObs.disconnect();
        controls.dispose();
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              (obj.material as THREE.Material).dispose();
            }
          }
        });
        texCache.forEach((t) => t?.dispose());
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    }

    init().catch(console.error);

    return () => {
      isMounted = false;
      disposeAll?.();
    };
  }, [xmlContent]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full bg-slate-900 rounded-lg overflow-hidden ${className}`}
    />
  );
}
