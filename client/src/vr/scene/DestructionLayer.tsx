import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { Destruction, type Building } from "@/vr/destruction";
import { buildBuildings, type BuildingSpec } from "@/vr/data";
import { computeBlockedLinks } from "@/vr/los";
import { QUAKE_DURATION, groundAccel, groundOffset } from "@/vr/quake";
import type { SimSettings } from "@/vr/settings";
import { Dust, type DustApi } from "./Dust";

/** Control surface the page uses to drive the physics scene. */
export interface SimApi {
  startQuake(): void;
  isQuaking(): boolean;
  /** Fire a ball. Both points are in world coordinates. */
  shoot(origin: THREE.Vector3, target: THREE.Vector3): void;
  /** Demolish an intact building, or rebuild a collapsed one. */
  toggleBuilding(buildingId: string): "demolished" | "rebuilt";
  resetAll(): void;
}

interface Props {
  settings: React.MutableRefObject<SimSettings>;
  dead: ReadonlySet<string>;
  /** Group that is shaken during a quake; also the parent of the blocks. */
  shakeGroup: React.RefObject<THREE.Group>;
  apiRef: React.MutableRefObject<SimApi | null>;
  onCollapse: (spec: BuildingSpec) => void;
  onBlockedChange: (blocked: Set<string>) => void;
  onQuakeChange: (active: boolean) => void;
  onImpact: (speed: number) => void;
}

const FIXED_DT = 1 / 60;
const BALL_SPEED = 38;
const LOS_INTERVAL = 0.4; // seconds between line-of-sight recomputations

/**
 * Owns the physics world (via @react-three/rapier's <Physics paused>, which
 * only creates the world; we step it ourselves so we can scale time) and the
 * Destruction system, and drives them from the render loop.
 */
export function DestructionLayer(props: Props) {
  const { rapier, world } = useRapier();
  const [sim, setSim] = useState<Destruction | null>(null);

  const live = useRef(props);
  live.current = props;

  const dust = useRef<DustApi>(null);
  const quake = useRef({ active: false, t: 0 });
  const acc = useRef(0);
  const losTimer = useRef(0);
  const lastBlockedKey = useRef("");

  useEffect(() => {
    const d = new Destruction(rapier, world, buildBuildings());
    d.callbacks = {
      onCollapse: (b: Building) => {
        dust.current?.burst(
          new THREE.Vector3(b.spec.x, b.blocks[0].home.y + b.spec.h * 0.3, b.spec.z),
          b.spec.kind === "scenery" ? 40 : 90,
        );
        live.current.onCollapse(b.spec);
      },
      onImpact: (speed) => live.current.onImpact(speed),
    };
    setSim(d);
    return () => d.dispose();
  }, [rapier, world]);

  // Antenna lamps follow the alive / dead state of each node.
  useEffect(() => {
    if (!sim) return;
    for (const b of sim.buildings) {
      if (b.spec.nodeId) sim.setNodeLit(b.spec.nodeId, !props.dead.has(b.spec.nodeId));
    }
  }, [sim, props.dead]);

  // The control surface for the page.
  useEffect(() => {
    if (!sim) return;
    live.current.apiRef.current = {
      startQuake() {
        quake.current = { active: true, t: 0 };
        live.current.onQuakeChange(true);
      },
      isQuaking: () => quake.current.active,
      shoot(origin, target) {
        const g = live.current.shakeGroup.current;
        const o = origin.clone();
        const t = target.clone();
        if (g) {
          g.worldToLocal(o);
          g.worldToLocal(t);
        }
        sim.shoot(o, t, BALL_SPEED, live.current.settings.current.gravity);
      },
      toggleBuilding(id) {
        const b = sim.getBuilding(id);
        if (!b) return "rebuilt";
        const nodeDead = b.spec.nodeId ? live.current.dead.has(b.spec.nodeId) : false;
        if (b.collapsed || nodeDead) {
          sim.rebuild(b);
          return "rebuilt";
        }
        sim.demolish(b);
        return "demolished";
      },
      resetAll() {
        quake.current = { active: false, t: 0 };
        live.current.onQuakeChange(false);
        sim.resetAll();
      },
    };
    return () => {
      live.current.apiRef.current = null;
    };
  }, [sim]);

  useFrame((_, delta) => {
    if (!sim) return;
    const s = live.current.settings.current;
    const group = live.current.shakeGroup.current;

    // Fixed-step loop: physics always advances in the same small slices,
    // however long the frame took. Slow motion shrinks each slice instead of
    // skipping frames, so it stays smooth.
    acc.current += Math.min(delta, 0.1);
    let steps = 0;
    while (acc.current >= FIXED_DT && steps < 4) {
      const h = FIXED_DT * s.timeScale;
      let accel: [number, number] = [0, 0];
      if (quake.current.active) {
        accel = groundAccel(quake.current.t, s.quakeIntensity);
        quake.current.t += h;
        if (quake.current.t >= QUAKE_DURATION) {
          quake.current.active = false;
          live.current.onQuakeChange(false);
        }
      }
      sim.step(h, { gravity: s.gravity, quake: accel });
      acc.current -= FIXED_DT;
      steps++;
    }
    sim.syncMeshes();

    // Ground shake, drawn by moving the whole world group. The camera does not
    // move: shaking the camera would make people sick in a headset.
    if (group) {
      if (quake.current.active) {
        const [dx, dz] = groundOffset(quake.current.t, s.quakeIntensity);
        group.position.set(dx, 0, dz);
      } else if (group.position.lengthSq() > 0) {
        group.position.set(0, 0, 0);
      }
    }

    // Line of sight, a few times per second.
    losTimer.current += delta;
    if (losTimer.current > LOS_INTERVAL) {
      losTimer.current = 0;
      const offset = group ? group.position : new THREE.Vector3();
      const blocked = computeBlockedLinks(sim.obstacles, live.current.dead, offset);
      const key = Array.from(blocked).sort().join(",");
      if (key !== lastBlockedKey.current) {
        lastBlockedKey.current = key;
        live.current.onBlockedChange(blocked);
      }
    }
  });

  return (
    <>
      {sim && <primitive object={sim.group} />}
      <Dust ref={dust} settings={props.settings} />
    </>
  );
}
