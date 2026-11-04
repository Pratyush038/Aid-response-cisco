import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { VR_LINKS, VR_NODES, towerTop } from "@/vr/data";
import { linkKey } from "@/vr/mesh";

const GOLD = "#C8A97E";
const TEAL = "#3fb8af";
const RED = "#c2453d";

const specs = new Map(VR_NODES.map((n) => [n.nodeId, n]));

/**
 * Radio links as lines between antenna tips.
 *   gold          on the active route
 *   teal          usable
 *   red, dashed   unusable: an endpoint is dead (faint) or the line of sight is blocked (strong)
 */
export function Links({
  path,
  dead,
  blocked,
}: {
  path: string[];
  dead: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
}) {
  const onPath = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) s.add(linkKey(path[i], path[i + 1]));
    return s;
  }, [path]);

  return (
    <>
      {VR_LINKS.map((l) => {
        const key = linkKey(l.from, l.to);
        const endsAlive = !dead.has(l.from) && !dead.has(l.to);
        const isBlocked = endsAlive && blocked.has(key);
        const usable = endsAlive && !isBlocked;
        const highlighted = usable && onPath.has(key);
        return (
          <Line
            key={key}
            points={[towerTop(specs.get(l.from)!), towerTop(specs.get(l.to)!)]}
            color={highlighted ? GOLD : usable ? TEAL : RED}
            lineWidth={highlighted ? 3.5 : 1.2}
            dashed={!usable}
            dashSize={0.6}
            gapSize={0.6}
            transparent
            opacity={highlighted ? 1 : usable ? 0.55 : isBlocked ? 0.75 : 0.25}
          />
        );
      })}
    </>
  );
}

/** Small spheres that travel along the active route. */
export function Packets({
  path,
}: {
  path: string[];
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  const { points, cumulative, total } = useMemo(() => {
    const pts = path.map((id) => new THREE.Vector3(...towerTop(specs.get(id)!)));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { points: pts, cumulative: cum, total: cum[cum.length - 1] };
  }, [path]);

  useFrame(({ clock }) => {
    if (points.length < 2 || total === 0) return;
    const speed = 9; // world units per second
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const d = (clock.elapsedTime * speed + (i * total) / 4) % total;
      let s = 1;
      while (s < cumulative.length - 1 && cumulative[s] < d) s++;
      const segLen = cumulative[s] - cumulative[s - 1] || 1;
      mesh.position.lerpVectors(points[s - 1], points[s], (d - cumulative[s - 1]) / segLen);
    });
  });

  if (points.length < 2) return null;
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshBasicMaterial color="#ffd58a" />
        </mesh>
      ))}
    </>
  );
}
