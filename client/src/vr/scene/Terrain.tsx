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
    return g;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#2b3a2f" flatShading />
    </mesh>
  );
}
