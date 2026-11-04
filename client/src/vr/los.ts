// Line of sight between antennas.
//
// A LoRa link only works if the straight segment between the two antenna tips
// is not blocked. We test that with a THREE.Raycaster: cast a ray from one tip
// towards the other, limited to the distance between them, against every
// building block mesh. Any hit means the link is blocked.
//
// Because the blocks are the live, physics-driven meshes, a collapsed building
// stops blocking automatically, and a pile of debris can start blocking.

import * as THREE from "three";
import { VR_LINKS, VR_NODES, towerTop } from "./data";
import { linkKey } from "./mesh";

const tips = new Map<string, THREE.Vector3>();
for (const n of VR_NODES) tips.set(n.nodeId, new THREE.Vector3(...towerTop(n)));

const raycaster = new THREE.Raycaster();
const dir = new THREE.Vector3();
const origin = new THREE.Vector3();

/**
 * @param obstacles   block meshes to test against
 * @param dead        dead nodes (their links are already unusable, skip them)
 * @param worldOffset current shake offset of the world group, so the ray and
 *                    the shaken meshes are in the same frame
 */
export function computeBlockedLinks(
  obstacles: THREE.Object3D[],
  dead: ReadonlySet<string>,
  worldOffset: THREE.Vector3,
): Set<string> {
  const blocked = new Set<string>();
  for (const l of VR_LINKS) {
    if (dead.has(l.from) || dead.has(l.to)) continue;
    const a = tips.get(l.from)!;
    const b = tips.get(l.to)!;
    origin.copy(a).add(worldOffset);
    dir.copy(b).sub(a);
    const dist = dir.length();
    dir.normalize();
    raycaster.set(origin, dir);
    raycaster.far = dist;
    // recursive = false: the obstacle list already holds the meshes
    if (raycaster.intersectObjects(obstacles, false).length > 0) {
      blocked.add(linkKey(l.from, l.to));
    }
  }
  return blocked;
}
