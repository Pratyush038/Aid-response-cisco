import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { softDot } from "@/vr/textures";
import type { SimSettings } from "@/vr/settings";
import { noRaycast } from "./noRaycast";

const MAX = 900;

export interface DustApi {
  /** Release a cloud of dust at `p` (physics-frame coordinates). */
  burst(p: THREE.Vector3, count?: number): void;
}

/**
 * Dust cloud particles. A fixed pool of points; each has a position, velocity
 * and remaining life. Particles drift upwards, slow down (drag) and fade out.
 */
export const Dust = forwardRef<DustApi, { settings: React.MutableRefObject<SimSettings> }>(function Dust(
  { settings },
  ref,
) {
  const state = useMemo(
    () => ({
      pos: new Float32Array(MAX * 3).fill(-1000),
      vel: new Float32Array(MAX * 3),
      life: new Float32Array(MAX),
      next: 0,
    }),
    [],
  );
  const geo = useRef<THREE.BufferGeometry>(null);

  useImperativeHandle(ref, () => ({
    burst(p, count = 60) {
      for (let k = 0; k < count; k++) {
        const i = state.next;
        state.next = (state.next + 1) % MAX;
        state.pos.set([p.x + (Math.random() - 0.5) * 2, p.y + Math.random() * 2, p.z + (Math.random() - 0.5) * 2], i * 3);
        state.vel.set([(Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4], i * 3);
        state.life[i] = 2 + Math.random() * 2;
      }
    },
  }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1) * settings.current.timeScale;
    for (let i = 0; i < MAX; i++) {
      if (state.life[i] <= 0) continue;
      state.life[i] -= dt;
      const drag = Math.exp(-1.5 * dt);
      for (let a = 0; a < 3; a++) {
        state.vel[i * 3 + a] *= drag;
        state.pos[i * 3 + a] += state.vel[i * 3 + a] * dt;
      }
      if (state.life[i] <= 0) state.pos[i * 3 + 1] = -1000;
    }
    const attr = geo.current?.attributes.position as THREE.BufferAttribute | undefined;
    if (attr) attr.needsUpdate = true;
  });

  return (
    <points frustumCulled={false} raycast={noRaycast}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" array={state.pos} count={MAX} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        map={softDot() ?? undefined}
        color="#c9c0b2"
        size={3.2}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
});
