import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { VR_LINKS, VR_NODES, buildBuildings, mulberry32, terrainHeight } from "@/vr/data";
import { noRaycast } from "./noRaycast";

const nodePos = new Map(VR_NODES.map((n) => [n.nodeId, n]));

/** Dark road ribbons along every seed link, following the terrain height. */
export function Roads() {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    const half = 0.55;
    for (const l of VR_LINKS) {
      const a = nodePos.get(l.from)!;
      const b = nodePos.get(l.to)!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(2, Math.ceil(len / 1.5));
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      const base = pos.length / 3;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        for (const s of [-1, 1]) {
          const px = x - dz * half * s;
          const pz = z + dx * half * s;
          pos.push(px, terrainHeight(px, pz) + 0.06, pz);
        }
        if (i > 0) {
          const k = base + i * 2;
          idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow raycast={noRaycast}>
      <meshStandardMaterial color="#3b3a3f" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Instanced pine-like trees, kept clear of buildings. Decoration only. */
export function Trees({ count = 180 }: { count?: number }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  const spots = useMemo(() => {
    const rand = mulberry32(4242);
    const blds = buildBuildings();
    const out: { x: number; z: number; s: number }[] = [];
    let tries = 0;
    while (out.length < count && tries++ < 4000) {
      const x = (rand() - 0.5) * 84;
      const z = (rand() - 0.5) * 84;
      if (blds.some((b) => Math.abs(b.x - x) < b.w / 2 + 2.2 && Math.abs(b.z - z) < b.d / 2 + 2.2)) continue;
      // keep roads clear
      let nearRoad = false;
      for (const l of VR_LINKS) {
        const a = nodePos.get(l.from)!;
        const b = nodePos.get(l.to)!;
        const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2)));
        if (Math.hypot(x - (a.x + (b.x - a.x) * t), z - (a.z + (b.z - a.z) * t)) < 1.8) {
          nearRoad = true;
          break;
        }
      }
      if (!nearRoad) out.push({ x, z, s: 0.7 + rand() * 0.8 });
    }
    return out;
  }, [count]);

  useEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach((p, i) => {
      const y = terrainHeight(p.x, p.z);
      m.compose(new THREE.Vector3(p.x, y + 0.4 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s));
      trunks.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p.x, y + 1.9 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s));
      crowns.current?.setMatrixAt(i, m);
    });
    [trunks.current, crowns.current].forEach((im) => {
      if (im) im.instanceMatrix.needsUpdate = true;
    });
  }, [spots]);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} raycast={noRaycast}>
        <cylinderGeometry args={[0.12, 0.18, 0.8, 6]} />
        <meshStandardMaterial color="#5a4632" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, spots.length]} raycast={noRaycast}>
        <coneGeometry args={[0.9, 2.6, 7]} />
        <meshStandardMaterial color="#2f5a3a" roughness={0.9} />
      </instancedMesh>
    </>
  );
}
