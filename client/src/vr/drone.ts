// Behaviour model of the relay drone: a small finite-state machine.
//
//   PATROL    fly the closed patrol loop at constant speed
//   RELAY     a pair of otherwise disconnected nodes is in range: leave the
//             loop, hover midway between them and act as a radio relay
//   COOLDOWN  relay time is over (or the gap was closed): fly the loop again
//             but ignore new relay opportunities for a while
//
// The drone senses its surroundings (distance to antenna tips) and the
// network (connected components), and reacts. That perception -> decision ->
// action loop is what makes it a behaviour model rather than an animation.

import * as THREE from "three";
import { VR_NODES, towerTop } from "./data";

export type DronePhase = "patrol" | "relay" | "cooldown";

export const DRONE_RANGE = 17; // radio range to an antenna tip, world units
export const DRONE_SPEED = 7; // units per second
export const RELAY_TIME = 12; // seconds spent relaying at most
export const COOLDOWN_TIME = 6;
export const DRONE_ALTITUDE = 13;

/** Patrol loop over the map, closed Catmull-Rom spline. */
export const patrolCurve = new THREE.CatmullRomCurve3(
  [
    [-22, DRONE_ALTITUDE, 20],
    [-2, DRONE_ALTITUDE + 2, 16],
    [20, DRONE_ALTITUDE, 10],
    [26, DRONE_ALTITUDE + 2, -8],
    [10, DRONE_ALTITUDE, -22],
    [-8, DRONE_ALTITUDE + 2, -20],
    [-22, DRONE_ALTITUDE, -4],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  "catmullrom",
  0.5,
);

const tips = new Map<string, THREE.Vector3>();
for (const n of VR_NODES) tips.set(n.nodeId, new THREE.Vector3(...towerTop(n)));

export function tipOf(nodeId: string): THREE.Vector3 {
  return tips.get(nodeId)!;
}

export interface RelayPair {
  a: string;
  b: string;
}

/**
 * Best pair of alive, mutually disconnected nodes that are both inside the
 * radio range from `pos`. "Best" = smallest worst-case distance.
 */
export function findRelayPair(
  pos: THREE.Vector3,
  components: ReadonlyMap<string, number>,
): RelayPair | null {
  const near: string[] = [];
  components.forEach((_, id) => {
    if (pos.distanceTo(tipOf(id)) <= DRONE_RANGE) near.push(id);
  });
  let best: RelayPair | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      if (components.get(near[i]) === components.get(near[j])) continue;
      const score = Math.max(pos.distanceTo(tipOf(near[i])), pos.distanceTo(tipOf(near[j])));
      if (score < bestScore) {
        bestScore = score;
        best = { a: near[i], b: near[j] };
      }
    }
  }
  return best;
}

/** Hover point for a relay pair: above the midpoint of the two antenna tips. */
export function relayHoverPoint(pair: RelayPair): THREE.Vector3 {
  const mid = tipOf(pair.a).clone().add(tipOf(pair.b)).multiplyScalar(0.5);
  mid.y = Math.max(mid.y + 4, DRONE_ALTITUDE - 2);
  return mid;
}
