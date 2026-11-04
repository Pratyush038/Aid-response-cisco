import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  COOLDOWN_TIME,
  DRONE_RANGE,
  DRONE_SPEED,
  RELAY_TIME,
  findRelayPair,
  patrolCurve,
  relayHoverPoint,
  tipOf,
  type DronePhase,
  type RelayPair,
} from "@/vr/drone";
import { connectedComponents } from "@/vr/mesh";
import type { SimSettings } from "@/vr/settings";

const CURVE_LENGTH = patrolCurve.getLength();
const SAMPLES = 80;

/** u in [0,1) of the patrol-curve point closest to `p`. */
function nearestU(p: THREE.Vector3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const d = patrolCurve.getPointAt(i / SAMPLES).distanceTo(p);
    if (d < bestD) {
      bestD = d;
      best = i / SAMPLES;
    }
  }
  return best;
}

interface Props {
  dead: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
  settings: React.MutableRefObject<SimSettings>;
  enabled: boolean;
  /** The pair currently relayed through the drone (null = no drone link). */
  onLink: (pair: RelayPair | null) => void;
  onPhase: (phase: DronePhase, pair: RelayPair | null) => void;
}

/**
 * Relay drone. Runs the state machine from vr/drone.ts every frame.
 * See that file for the PATROL / RELAY / COOLDOWN rules.
 */
export function DroneActor({ dead, blocked, settings, enabled, onLink, onPhase }: Props) {
  const group = useRef<THREE.Group>(null);
  const rotors = useRef<THREE.Mesh[]>([]);

  // Latest props, read inside useFrame without re-creating the callback.
  const live = useRef({ dead, blocked, enabled, onLink, onPhase });
  live.current = { dead, blocked, enabled, onLink, onPhase };

  const st = useRef({
    phase: "patrol" as DronePhase,
    u: 0,
    pos: patrolCurve.getPointAt(0),
    timer: 0,
    checkTimer: 0,
    pair: null as RelayPair | null,
    linkActive: false,
  });

  // Two thin lines from the drone to the two antennas while it relays.
  const beams = useMemo(() => {
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#8ad0ff" }));
      l.frustumCulled = false;
      l.visible = false;
      return l;
    };
    return [mk(), mk()];
  }, []);
  useEffect(
    () => () => beams.forEach((b) => {
      b.geometry.dispose();
      (b.material as THREE.Material).dispose();
    }),
    [beams],
  );

  function setPhase(p: DronePhase) {
    st.current.phase = p;
    st.current.timer = 0;
    live.current.onPhase(p, st.current.pair);
  }

  function setLink(active: boolean) {
    const s = st.current;
    if (s.linkActive === active) return;
    s.linkActive = active;
    live.current.onLink(active ? s.pair : null);
  }

  useFrame((_, delta) => {
    const s = st.current;
    const { dead, blocked, enabled } = live.current;
    const dt = Math.min(delta, 0.1) * settings.current.timeScale;

    if (!enabled) {
      if (s.linkActive) setLink(false);
      if (group.current) group.current.visible = false;
      beams.forEach((b) => (b.visible = false));
      return;
    }
    if (group.current) group.current.visible = true;

    s.timer += dt;
    s.checkTimer += dt;
    const check = s.checkTimer > 0.3;
    if (check) s.checkTimer = 0;

    if (s.phase === "relay") {
      const pair = s.pair!;
      // Fly to the hover point above the pair.
      const hover = relayHoverPoint(pair);
      const to = hover.clone().sub(s.pos);
      const step = DRONE_SPEED * 1.5 * dt;
      if (to.length() > step) s.pos.add(to.setLength(step));
      else s.pos.copy(hover);

      const inRange =
        s.pos.distanceTo(tipOf(pair.a)) <= DRONE_RANGE &&
        s.pos.distanceTo(tipOf(pair.b)) <= DRONE_RANGE;
      const alive = !dead.has(pair.a) && !dead.has(pair.b);
      let stillNeeded = alive;
      if (check && alive) {
        const comps = connectedComponents(dead, blocked);
        stillNeeded = comps.get(pair.a) !== comps.get(pair.b);
      }
      setLink(inRange && alive && stillNeeded);
      if (!alive || !stillNeeded || s.timer > RELAY_TIME) {
        setLink(false);
        s.u = nearestU(s.pos);
        setPhase("cooldown");
      }
    } else {
      // PATROL and COOLDOWN both follow the loop. After a relay the drone may
      // be away from the loop: it chases its target point on the loop.
      s.u = (s.u + (DRONE_SPEED * dt) / CURVE_LENGTH) % 1;
      const target = patrolCurve.getPointAt(s.u);
      const to = target.sub(s.pos);
      const maxStep = DRONE_SPEED * 1.6 * dt;
      if (to.length() > maxStep) s.pos.add(to.setLength(maxStep));
      else s.pos.add(to);

      if (s.phase === "cooldown" && s.timer > COOLDOWN_TIME) setPhase("patrol");
      if (s.phase === "patrol" && check) {
        const pair = findRelayPair(s.pos, connectedComponents(dead, blocked));
        if (pair) {
          s.pair = pair;
          setPhase("relay");
        }
      }
    }

    // Visuals
    if (group.current) group.current.position.copy(s.pos);
    rotors.current.forEach((r) => r && (r.rotation.y += 40 * dt));
    const pair = s.pair;
    beams.forEach((b, i) => {
      b.visible = s.linkActive && !!pair;
      if (!b.visible || !pair) return;
      const tip = tipOf(i === 0 ? pair.a : pair.b);
      const attr = b.geometry.attributes.position as THREE.BufferAttribute;
      attr.setXYZ(0, s.pos.x, s.pos.y, s.pos.z);
      attr.setXYZ(1, tip.x, tip.y, tip.z);
      attr.needsUpdate = true;
    });
  });

  return (
    <>
      <group ref={group}>
        <mesh>
          <boxGeometry args={[1.2, 0.35, 1.2]} />
          <meshStandardMaterial color="#d9e4ec" />
        </mesh>
        {[
          [0.8, 0.8],
          [-0.8, 0.8],
          [0.8, -0.8],
          [-0.8, -0.8],
        ].map(([x, z], i) => (
          <mesh
            key={i}
            position={[x, 0.25, z]}
            ref={(el) => {
              if (el) rotors.current[i] = el;
            }}
          >
            <cylinderGeometry args={[0.55, 0.55, 0.04, 12]} />
            <meshStandardMaterial color="#8ad0ff" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
      {beams.map((b, i) => (
        <primitive key={i} object={b} />
      ))}
    </>
  );
}
