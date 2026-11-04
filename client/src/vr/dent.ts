// Surface deformation: a dent in a block's wall.
//
// Every block mesh is a BoxGeometry with several segments per side, so its
// faces carry a grid of vertices. When a projectile hits, we push the vertices
// near the impact point inward along the direction of travel. The push falls
// off smoothly with distance from the impact point:
//
//     d(r) = depth * (1 - (r / R)^2)^2     for r < R, else 0
//
// This is a "bump" function: its value and slope are both zero at r = R, so
// the dent blends into the undamaged wall with no visible crease.
//
// Only the drawn mesh changes. The physics collider stays a plain box (it is a
// cosmetic dent, not a structural one). That is a known simplification.

/**
 * Displace vertices of `positions` (x,y,z triples, local space of the mesh).
 * `center` is the impact point and `dir` the unit direction to push, both in
 * the same local space. Returns how many vertices moved.
 */
export function applyDent(
  positions: Float32Array,
  center: readonly [number, number, number],
  dir: readonly [number, number, number],
  radius: number,
  depth: number,
): number {
  const r2max = radius * radius;
  let moved = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - center[0];
    const dy = positions[i + 1] - center[1];
    const dz = positions[i + 2] - center[2];
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 >= r2max) continue;
    const t = 1 - r2 / r2max;
    const d = depth * t * t;
    positions[i] += dir[0] * d;
    positions[i + 1] += dir[1] * d;
    positions[i + 2] += dir[2] * d;
    moved++;
  }
  return moved;
}

/**
 * Dent depth from the impact impulse J = m * v (kg * u/s). Square-root growth:
 * doubling the impulse does not double the dent, and a hard cap keeps the
 * vertices from being pushed through the far side of the block.
 */
export function dentDepth(impulse: number, smallestHalfExtent: number): number {
  const raw = 0.045 * Math.sqrt(impulse);
  return Math.min(raw, 0.8 * smallestHalfExtent);
}
