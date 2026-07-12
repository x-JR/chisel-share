'use client';

import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';

interface Props {
  xmlContent: string;
  className?: string;
  schematicId?: string;
  canRotate?: boolean;
  onXmlUpdate?: (newXml: string) => void;
}

export default function SchematicViewer({ xmlContent, className = '', schematicId, canRotate, onXmlUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [solidColors, setSolidColors] = useState(false);
  const [hasMissingTextures, setHasMissingTextures] = useState(false);
  const [rotationSteps, setRotationSteps] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ref so the async init can read the latest toggle state after it finishes,
  // and so the toggle handler can call the swap immediately if init is done.
  const solidColorsRef = useRef(false);
  const applyModeRef = useRef<((solid: boolean) => void) | null>(null);
  const rotationStepsRef = useRef(0);
  const applyRotationRef = useRef<((steps: number) => void) | null>(null);

  function handleToggle(checked: boolean) {
    solidColorsRef.current = checked;
    setSolidColors(checked);
    applyModeRef.current?.(checked);
  }

  function handleRotateCW() {
    setSaveStatus('idle');
    setSaveError(null);
    const steps = (rotationStepsRef.current + 1) % 4;
    rotationStepsRef.current = steps;
    setRotationSteps(steps);
    applyRotationRef.current?.(steps);
  }

  function handleRotateCCW() {
    setSaveStatus('idle');
    setSaveError(null);
    const steps = (rotationStepsRef.current + 3) % 4;
    rotationStepsRef.current = steps;
    setRotationSteps(steps);
    applyRotationRef.current?.(steps);
  }

  async function handleSaveRotation() {
    if (!schematicId || rotationStepsRef.current === 0) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const { parseSchematicXml } = await import('@/lib/voxel-decoder');
      const { rotateCuboidsY, encodeVoxelData } = await import('@/lib/voxel-encoder');
      const schematic = parseSchematicXml(xmlContent);
      const rotated = rotateCuboidsY(schematic.cuboids, rotationStepsRef.current);
      const voxeldata = encodeVoxelData(rotated);
      const res = await fetch(`/api/schematics/${schematicId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voxeldata }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Save failed');
      }
      const { xmlContent: newXml } = await res.json() as { xmlContent: string };
      // Reset rotation before propagating the new XML so the rebuilt scene
      // starts at 0 rotation (the rotation is now baked into the saved file).
      rotationStepsRef.current = 0;
      setRotationSteps(0);
      applyRotationRef.current?.(0);
      onXmlUpdate?.(newXml);
      setSaveStatus('ok');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      setSaveStatus('error');
    }
  }

  useEffect(() => {
    if (!containerRef.current || !xmlContent) return;

    const container = containerRef.current;
    let animationId: number;
    let isMounted = true;
    let disposeAll: (() => void) | undefined;
    setHasMissingTextures(false);

    async function init() {
      const THREE = await import('three');
      const { OrbitControls } = await import(
        'three/examples/jsm/controls/OrbitControls.js'
      );
      const { parseSchematicXml } = await import('@/lib/voxel-decoder');
      const { resolveTexture, resolveTextureRotation, blockcodeToColor } = await import('@/lib/texture-resolver');

      if (!isMounted) return;

      const schematic = parseSchematicXml(xmlContent);
      if (!schematic.cuboids.length) return;

      // Detect blockcodes with no texture resolver (excluding intentionally colour-only blocks)
      const intentionallyColorOnly = (bc: string) =>
        /^game:creativeglow/.test(bc) || /^chiseltools:pastel-/.test(bc);
      const hasUnresolved = schematic.blockcodes.some(
        (bc) => resolveTexture(bc) === null && !intentionallyColorOnly(bc)
      );
      if (hasUnresolved) setHasMissingTextures(true);

      console.group('[SchematicViewer] Parsed schematic');
      console.log('Name:', schematic.name);
      console.log('Block codes:', schematic.blockcodes);
      console.log('Cuboid count:', schematic.cuboids.length);
      console.groupEnd();

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
      const cx = ((minX + maxX + 1) / 2) * V;
      const cy = ((minY + maxY + 1) / 2) * V;
      const cz = ((minZ + maxZ + 1) / 2) * V;
      const span = Math.max(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1) * V;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 200);
      camera.position.set(cx - span * 1.6, cy + span * 1.3, cz - span * 1.6);
      camera.lookAt(cx, cy, cz);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(1, 2, 1.5);
      scene.add(sun);

      // Texture loader + cache
      const loader = new THREE.TextureLoader();
      const texCache = new Map<number, THREE.Texture | null>();

      async function getTexture(matIdx: number): Promise<THREE.Texture | null> {
        if (texCache.has(matIdx)) return texCache.get(matIdx) ?? null;
        const blockcode = schematic.blockcodes[matIdx] ?? '';
        const url = resolveTexture(blockcode);
        console.log(`[SchematicViewer] matIdx=${matIdx} blockcode="${blockcode}" → resolvedUrl=${url ?? 'null (no match)'}`);
        if (!url) {
          texCache.set(matIdx, null);
          return null;
        }
        return new Promise((resolve) => {
          loader.load(
            url,
            (tex) => {
              console.log(`[SchematicViewer] matIdx=${matIdx} texture loaded OK: ${url}`);
              tex.magFilter = THREE.NearestFilter;
              tex.minFilter = THREE.NearestFilter;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              const rot = resolveTextureRotation(blockcode);
              if (rot) { tex.rotation = rot; tex.center.set(0.5, 0.5); }
              texCache.set(matIdx, tex);
              resolve(tex);
            },
            undefined,
            () => {
              console.warn(`[SchematicViewer] matIdx=${matIdx} texture FAILED to load: ${url}`);
              setHasMissingTextures(true);
              texCache.set(matIdx, null);
              resolve(null);
            }
          );
        });
      }

      // Separate material caches for each mode so swapping back is instant
      const texMatCache = new Map<number, THREE.MeshLambertMaterial>();
      const solidMatCache = new Map<number, THREE.MeshLambertMaterial>();

      async function getTexMaterial(matIdx: number): Promise<THREE.MeshLambertMaterial> {
        if (texMatCache.has(matIdx)) return texMatCache.get(matIdx)!;
        const tex = await getTexture(matIdx);
        const blockcode = schematic.blockcodes[matIdx] ?? '';
        const isGlow = blockcode.startsWith('game:creativeglow-');
        const isGlass = blockcode.startsWith('game:glass-');
        let mat: THREE.MeshLambertMaterial;
        if (tex) {
          mat = new THREE.MeshLambertMaterial({
            map: tex,
            ...(isGlow && { emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.7 }),
            ...(isGlass && { transparent: true, opacity: 0.9, depthWrite: false }),
          });
        } else {
          const blockcode = schematic.blockcodes[matIdx] ?? '';
          const isGlow = blockcode.includes('creativeglow');
          mat = new THREE.MeshLambertMaterial({
            color: isGlow ? 0xffe066 : new THREE.Color(blockcodeToColor(blockcode)),
            emissive: isGlow ? new THREE.Color(0xffaa00) : new THREE.Color(0),
            emissiveIntensity: isGlow ? 0.5 : 0,
          });
        }
        texMatCache.set(matIdx, mat);
        return mat;
      }

      function getSolidMaterial(matIdx: number): THREE.MeshLambertMaterial {
        if (solidMatCache.has(matIdx)) return solidMatCache.get(matIdx)!;
        const blockcode = schematic.blockcodes[matIdx] ?? '';
        const isGlow = blockcode.includes('creativeglow');
        const mat = new THREE.MeshLambertMaterial({
          color: isGlow ? 0xffe066 : new THREE.Color(blockcodeToColor(blockcode)),
          emissive: isGlow ? new THREE.Color(0xffaa00) : new THREE.Color(0),
          emissiveIntensity: isGlow ? 0.5 : 0,
        });
        solidMatCache.set(matIdx, mat);
        return mat;
      }

      // Group used for live Y-axis rotation preview (no scene rebuild needed)
      const meshGroup = new THREE.Group();
      meshGroup.position.set(cx, cy, cz);
      scene.add(meshGroup);

      // Build meshes and track matIdx per mesh for mode swapping
      const meshEntries: Array<{ mesh: THREE.Mesh; matIdx: number }> = [];

      for (const c of schematic.cuboids) {
        const cw = (c.x2 - c.x1 + 1) * V;
        const ch = (c.y2 - c.y1 + 1) * V;
        const cd = (c.z2 - c.z1 + 1) * V;
        const geo = new THREE.BoxGeometry(cw, ch, cd);

        // World-space UV mapping: derive UVs from each vertex's position in the
        // 16-voxel block grid so adjacent cuboids of the same material share the
        // same UV space and the texture tiles seamlessly across them.
        const meshPX = ((c.x1 + c.x2 + 1) / 2) * V;
        const meshPY = ((c.y1 + c.y2 + 1) / 2) * V;
        const meshPZ = ((c.z1 + c.z2 + 1) / 2) * V;
        const posAttr = geo.attributes.position;
        const norAttr = geo.attributes.normal;
        const uvAttr = geo.attributes.uv;
        for (let i = 0; i < posAttr.count; i++) {
          const nx = norAttr.getX(i);
          const ny = norAttr.getY(i);
          const wx = posAttr.getX(i) + meshPX;
          const wy = posAttr.getY(i) + meshPY;
          const wz = posAttr.getZ(i) + meshPZ;
          let u: number, v: number;
          if (Math.abs(nx) > 0.5) { u = wz; v = wy; }       // ±X face
          else if (Math.abs(ny) > 0.5) { u = wx; v = wz; }  // ±Y face
          else { u = wx; v = wy; }                           // ±Z face
          uvAttr.setXY(i, u, v);
        }
        uvAttr.needsUpdate = true;

        const mat = await getTexMaterial(c.matIdx);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          meshPX - cx,
          meshPY - cy,
          meshPZ - cz
        );
        meshGroup.add(mesh);
        meshEntries.push({ mesh, matIdx: c.matIdx });
      }

      // Grid helper at the base of the voxel space
      const grid = new THREE.GridHelper(1, 16, 0x555566, 0x333344);
      grid.position.set(0.5, 0, 0.5);
      scene.add(grid);

      // Material swap — called by the toggle handler
      applyModeRef.current = (solid: boolean) => {
        for (const { mesh, matIdx } of meshEntries) {
          mesh.material = solid ? getSolidMaterial(matIdx) : (texMatCache.get(matIdx) ?? getSolidMaterial(matIdx));
        }
      };

      // Apply whichever mode the user may have toggled while init was loading
      if (solidColorsRef.current) applyModeRef.current(true);

      // Rotation — called by the rotate handlers to spin the group without
      // tearing down and rebuilding the whole Three.js scene.
      applyRotationRef.current = (steps: number) => {
        meshGroup.rotation.y = -steps * Math.PI / 2;
      };
      // Restore any rotation the user may have applied before init finished.
      applyRotationRef.current(rotationStepsRef.current);

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(cx, cy, cz);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

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
        applyModeRef.current = null;
        applyRotationRef.current = null;
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

  const isChiselWiz = xmlContent.trimStart().startsWith('{');
  const showRotate = canRotate && !isChiselWiz;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="w-full h-full bg-slate-900 rounded-lg overflow-hidden" />

      {/* Solid colours toggle — bottom-right */}
      <label className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 cursor-pointer select-none backdrop-blur-sm transition-colors">
        <input
          type="checkbox"
          checked={solidColors}
          onChange={(e) => handleToggle(e.target.checked)}
          className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
        />
        <span className="text-slate-300 text-xs font-medium">Solid colours</span>
      </label>

      {/* Rotation controls — bottom-left (owners only, XML format only) */}
      {showRotate && (
        <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1.5">
          <div className="flex gap-1">
            <button
              onClick={handleRotateCCW}
              title="Rotate 90° counter-clockwise"
              className="flex items-center justify-center w-8 h-8 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 rounded-lg text-slate-300 text-base backdrop-blur-sm transition-colors"
            >
              ↺
            </button>
            <button
              onClick={handleRotateCW}
              title="Rotate 90° clockwise"
              className="flex items-center justify-center w-8 h-8 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 rounded-lg text-slate-300 text-base backdrop-blur-sm transition-colors"
            >
              ↻
            </button>
          </div>
          {rotationSteps !== 0 && saveStatus !== 'ok' && (
            <button
              onClick={handleSaveRotation}
              disabled={saveStatus === 'saving'}
              className="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-500/90 border border-amber-500/50 rounded-lg text-white text-xs font-medium backdrop-blur-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save rotation'}
            </button>
          )}
          {saveStatus === 'ok' && (
            <p className="text-emerald-400 text-xs bg-slate-900/80 rounded px-2 py-1">Saved!</p>
          )}
          {saveStatus === 'error' && saveError && (
            <p className="text-red-400 text-xs bg-slate-900/80 rounded px-2 py-1 max-w-[160px]">{saveError}</p>
          )}
        </div>
      )}

      {hasMissingTextures && (
        <div className="absolute top-3 left-3 right-16 flex items-center gap-2 bg-amber-950/80 border border-amber-700/50 rounded-lg px-3 py-2 text-xs text-amber-300 backdrop-blur-sm pointer-events-none">
          <span>⚠</span>
          Some textures couldn&apos;t be resolved — preview will differ from in-game.
        </div>
      )}
    </div>
  );
}
