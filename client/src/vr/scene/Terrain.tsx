import { useMemo } from "react";
import * as THREE from "three";
import { terrainHeight } from "@/vr/data";

/** Ground: a subdivided plane whose vertices are displaced by terrainHeight(). */
export function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(90, 90, 90, 90);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals();
    // Vertex colours: grass with patches, darker towards the map edge.
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const patch = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.55) * Math.sin(x * 0.13 + z * 0.21);
      const edge = Math.min(1, Math.hypot(x, z) / 48);
      c.setHSL(0.27 - 0.03 * patch, 0.32, 0.30 + 0.07 * patch - 0.1 * edge);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
