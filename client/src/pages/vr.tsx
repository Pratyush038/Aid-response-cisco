import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Link } from "wouter";
import {
  BODY_HEIGHT,
  GATEWAY_ID,
  MAST_HEIGHT,
  SOURCE_DEFAULT,
  VR_LINKS,
  VR_NODES,
  buildScenery,
  initialDeadNodes,
  terrainHeight,
  towerTop,
  type VrNodeSpec,
} from "@/vr/data";
import { computeRoute, describeChange, nodeName } from "@/vr/mesh";

type Mode = "source" | "destroy";

const GOLD = "#C8A97E";
const TEAL = "#3fb8af";
const RED = "#c2453d";

// ---------------------------------------------------------------- terrain

function Terrain() {
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

function Scenery() {
  const blocks = useMemo(() => buildScenery(), []);
  return (
    <>
      {blocks.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, terrainHeight(b.x, b.z) + b.h / 2, b.z]}
        >
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#6d6a63" />
        </mesh>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ nodes

interface NodeTowerProps {
  spec: VrNodeSpec;
  dead: boolean;
  isSource: boolean;
  onSelect: () => void;
}

function NodeTower({ spec, dead, isSource, onSelect }: NodeTowerProps) {
  const base = terrainHeight(spec.x, spec.z);
  const isGateway = spec.nodeId === GATEWAY_ID;

  const bodyColor = dead ? "#4a2523" : isGateway ? "#2f6f73" : "#b8b4aa";
  const lampColor = dead ? RED : isGateway ? "#4ff0e4" : "#6cf08a";

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelect();
  }

  return (
    <group
      position={[spec.x, base, spec.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* Building body. A destroyed node is shown squashed and tilted. */}
      <mesh
        position={[0, dead ? 0.55 : BODY_HEIGHT / 2, 0]}
        scale={[1, dead ? 0.35 : 1, 1]}
        rotation={[0, 0, dead ? 0.18 : 0]}
      >
        <boxGeometry args={[2.2, BODY_HEIGHT, 2.2]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {!dead && (
        <>
          {/* Antenna mast */}
          <mesh position={[0, BODY_HEIGHT + MAST_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[0.08, 0.12, MAST_HEIGHT, 8]} />
            <meshStandardMaterial color="#d7d3c8" />
          </mesh>
          {/* Lamp at the top, where links attach */}
          <mesh position={[0, BODY_HEIGHT + MAST_HEIGHT, 0]}>
            <sphereGeometry args={[0.38, 16, 16]} />
            <meshStandardMaterial
              color={lampColor}
              emissive={lampColor}
              emissiveIntensity={1.2}
            />
          </mesh>
        </>
      )}

      {/* Gold ring marks the current SOS source */}
      {isSource && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[2.4, 2.9, 48]} />
          <meshBasicMaterial color={GOLD} side={THREE.DoubleSide} />
        </mesh>
      )}

      <Html position={[0, BODY_HEIGHT + MAST_HEIGHT + 1.4, 0]} center distanceFactor={34}>
        <div
          className="pointer-events-none whitespace-nowrap rounded px-1.5 py-0.5 text-[11px]"
          style={{
            background: "rgba(17,17,16,0.75)",
            color: dead ? "#e58b84" : "#e8e4da",
            border: `1px solid ${isSource ? GOLD : "rgba(255,255,255,0.12)"}`,
          }}
        >
          {spec.name}
        </div>
      </Html>
    </group>
  );
}

// ------------------------------------------------------------------ links

function Links({ path, dead }: { path: string[]; dead: ReadonlySet<string> }) {
  const onPath = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) {
      s.add(`${path[i]}|${path[i + 1]}`);
      s.add(`${path[i + 1]}|${path[i]}`);
    }
    return s;
  }, [path]);

  const specs = useMemo(() => {
    const m = new Map<string, VrNodeSpec>();
    VR_NODES.forEach((n) => m.set(n.nodeId, n));
    return m;
  }, []);

  return (
    <>
      {VR_LINKS.map((l) => {
        const a = specs.get(l.from)!;
        const b = specs.get(l.to)!;
        const usable = !dead.has(l.from) && !dead.has(l.to);
        const highlighted = usable && onPath.has(`${l.from}|${l.to}`);
        return (
          <Line
            key={`${l.from}-${l.to}`}
            points={[towerTop(a), towerTop(b)]}
            color={highlighted ? GOLD : usable ? TEAL : RED}
            lineWidth={highlighted ? 3.5 : 1.2}
            dashed={!usable}
            dashSize={0.6}
            gapSize={0.6}
            transparent
            opacity={highlighted ? 1 : usable ? 0.55 : 0.25}
          />
        );
      })}
    </>
  );
}

/** Small spheres that travel along the active route. */
function Packets({ path }: { path: string[] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  const { points, cumulative, total } = useMemo(() => {
    const pts = path.map((id) => {
      const spec = VR_NODES.find((n) => n.nodeId === id)!;
      return new THREE.Vector3(...towerTop(spec));
    });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
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
      const t = (d - cumulative[s - 1]) / segLen;
      mesh.position.lerpVectors(points[s - 1], points[s], t);
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

// ------------------------------------------------------------------- page

export default function VrSimulation() {
  const [dead, setDead] = useState<Set<string>>(() => initialDeadNodes());
  const [source, setSource] = useState<string>(SOURCE_DEFAULT);
  const [mode, setMode] = useState<Mode>("destroy");
  const [log, setLog] = useState<string[]>([
    "Click a tower to destroy it and watch the mesh reroute.",
  ]);

  const route = useMemo(() => computeRoute(source, dead), [source, dead]);
  const path = route?.path ?? [];

  function pushLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 6));
  }

  function handleSelect(nodeId: string) {
    if (mode === "source") {
      if (dead.has(nodeId)) {
        pushLog(`${nodeName(nodeId)} is down and cannot be a source.`);
        return;
      }
      setSource(nodeId);
      const r = computeRoute(nodeId, dead);
      pushLog(
        r
          ? `Source set to ${nodeName(nodeId)}: ${r.hops} hops to the gateway.`
          : `Source set to ${nodeName(nodeId)}: no route to the gateway.`,
      );
      return;
    }

    const before = computeRoute(source, dead);
    const next = new Set(dead);
    const wasDead = next.has(nodeId);
    if (wasDead) next.delete(nodeId);
    else next.add(nodeId);
    const after = computeRoute(source, next);
    setDead(next);
    pushLog(
      `${nodeName(nodeId)} ${wasDead ? "restored" : "destroyed"}. ${describeChange(before, after)}`,
    );
  }

  function reset() {
    setDead(initialDeadNodes());
    setSource(SOURCE_DEFAULT);
    setLog(["Scene reset."]);
  }

  return (
    <div className="relative h-screen w-screen" style={{ background: "#111110" }}>
      <Canvas camera={{ position: [0, 38, 62], fov: 55 }}>
        <color attach="background" args={["#111110"]} />
        <fog attach="fog" args={["#111110", 90, 190]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[30, 50, 20]} intensity={1.1} />

        <Terrain />
        <Scenery />
        <Links path={path} dead={dead} />
        <Packets path={path} />
        {VR_NODES.map((spec) => (
          <NodeTower
            key={spec.nodeId}
            spec={spec}
            dead={dead.has(spec.nodeId)}
            isSource={spec.nodeId === source}
            onSelect={() => handleSelect(spec.nodeId)}
          />
        ))}

        <OrbitControls
          target={[0, 0, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={8}
          maxDistance={120}
        />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-sm text-[#e8e4da]">
        <div className="flex items-start justify-between gap-4">
          <div
            className="pointer-events-auto rounded-md p-3"
            style={{ background: "rgba(17,17,16,0.85)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="mb-2 text-base font-medium" style={{ color: GOLD }}>
              ResQNet 3D Mesh Simulator
            </div>
            <div className="flex gap-2">
              {(["destroy", "source"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="rounded border px-2 py-1"
                  style={{
                    borderColor: mode === m ? GOLD : "rgba(255,255,255,0.2)",
                    color: mode === m ? GOLD : "#e8e4da",
                  }}
                >
                  {m === "destroy" ? "Destroy / restore" : "Set SOS source"}
                </button>
              ))}
              <button
                onClick={reset}
                className="rounded border px-2 py-1"
                style={{ borderColor: "rgba(255,255,255,0.2)" }}
              >
                Reset
              </button>
              <Link
                href="/simulation"
                className="rounded border px-2 py-1"
                style={{ borderColor: "rgba(255,255,255,0.2)" }}
              >
                2D view
              </Link>
            </div>
          </div>

          <div
            className="pointer-events-auto w-80 rounded-md p-3"
            style={{ background: "rgba(17,17,16,0.85)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="mb-1 font-medium" style={{ color: GOLD }}>
              SOS route
            </div>
            <div className="text-xs opacity-80">From: {nodeName(source)}</div>
            {route ? (
              <>
                <div className="mt-1 text-xs">
                  {route.path.map(nodeName).join("  >  ")}
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {route.hops} hops, cost {route.totalDistance.toFixed(1)}
                </div>
              </>
            ) : (
              <div className="mt-1 text-xs" style={{ color: "#e58b84" }}>
                No route to the gateway. This node is cut off.
              </div>
            )}
          </div>
        </div>

        <div
          className="pointer-events-auto max-w-xl rounded-md p-3"
          style={{ background: "rgba(17,17,16,0.85)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="mb-1 font-medium" style={{ color: GOLD }}>
            Event log
          </div>
          {log.map((line, i) => (
            <div key={i} className="text-xs" style={{ opacity: i === 0 ? 1 : 0.6 }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
