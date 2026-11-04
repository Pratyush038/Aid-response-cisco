import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { XR, createXRStore } from "@react-three/xr";
import * as THREE from "three";
import { Link } from "wouter";
import { SOURCE_DEFAULT, VR_NODES, buildBuildings, initialDeadNodes, type BuildingSpec } from "@/vr/data";
import { computeRoute, describeChange, nodeName, type ExtraLink } from "@/vr/mesh";
import { DEFAULT_SETTINGS, SLOWMO_SCALE, type SimSettings } from "@/vr/settings";
import type { DronePhase, RelayPair } from "@/vr/drone";
import { playAlert, playCollapse, playImpact, setSoundEnabled, unlockAudio, vibrate } from "@/vr/audio";
import { Terrain } from "@/vr/scene/Terrain";
import { Links, Packets } from "@/vr/scene/Links";
import { NodeLabels, SourceRing } from "@/vr/scene/Labels";
import { Intro } from "@/vr/scene/Intro";
import { DroneActor } from "@/vr/scene/DroneActor";
import { DestructionLayer, type SimApi } from "@/vr/scene/DestructionLayer";
import { CardboardRig } from "@/vr/scene/CardboardRig";
import { TeleportTarget, VrRig } from "@/vr/scene/VrRig";
import type { HudModel } from "@/vr/scene/WorldHud";
import { requestGyroPermission } from "@/vr/gyro";
import { sendSync, subscribeSync, type SyncMessage } from "@/vr/sync";

type Mode = "destroy" | "source" | "shoot";
/** desktop = mouse and orbit camera; cardboard = phone stereo view with gyroscope. */
type View = "desktop" | "cardboard";

/** Where the player starts: south of the map, looking north over it. */
const START_VIEWPOINT: [number, number] = [0, 43];

const GOLD = "#C8A97E";
const PANEL = { background: "rgba(17,17,16,0.85)", border: "1px solid rgba(255,255,255,0.1)" };

/** Link cost used for a drone relay (km and ms, same units as the seed links). */
const DRONE_LINK = { distance: 2.0, latency: 60 };

export default function VrSimulation() {
  const [dead, setDead] = useState<Set<string>>(() => initialDeadNodes());
  const [source, setSource] = useState<string>(SOURCE_DEFAULT);
  const [mode, setMode] = useState<Mode>("destroy");
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());
  const [droneLink, setDroneLink] = useState<RelayPair | null>(null);
  const [dronePhase, setDronePhase] = useState<DronePhase>("patrol");
  const [droneOn, setDroneOn] = useState(true);
  const [syncOn, setSyncOn] = useState(false);
  const [night, setNight] = useState(false);
  const [quaking, setQuaking] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [gravity, setGravity] = useState(DEFAULT_SETTINGS.gravity);
  const [intensity, setIntensity] = useState(DEFAULT_SETTINGS.quakeIntensity);
  const [sound, setSound] = useState(true);
  // Shadows are costly; skip them on phones (coarse pointer).
  const highQuality = useMemo(
    () => typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches,
    [],
  );
  const [demoCaption, setDemoCaption] = useState<string | null>(null);
  const demoToken = useRef(0);
  const [view, setView] = useState<View>("desktop");
  const [inVr, setInVr] = useState(false);
  const [viewpoint, setViewpoint] = useState<[number, number]>(START_VIEWPOINT);
  const [log, setLog] = useState<string[]>([
    "Click a building to demolish it, or use Earthquake / Shoot.",
  ]);

  // ---- refs mirroring state, for callbacks that outlive a render ----------
  // The XR store is created here, not at module level: creating it can inject a
  // WebXR emulator on localhost, which must not happen on the other pages.
  const xrStore = useMemo(() => createXRStore({ controller: { teleportPointer: true } }), []);
  useEffect(() => {
    return xrStore.subscribe((state) => setInVr(state.session != null));
  }, [xrStore]);

  const settings = useRef<SimSettings>({ ...DEFAULT_SETTINGS });
  const apiRef = useRef<SimApi | null>(null);
  const shakeGroup = useRef<THREE.Group>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const deadRef = useRef(dead);
  deadRef.current = dead;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const droneRef = useRef(droneOn);
  droneRef.current = droneOn;
  const quakeStats = useRef({ scenery: 0, landmarks: 0 });
  const lastSound = useRef(0);

  const extra: ExtraLink[] = useMemo(
    () => (droneLink ? [{ from: droneLink.a, to: droneLink.b, ...DRONE_LINK }] : []),
    [droneLink],
  );
  const route = useMemo(
    () => computeRoute(source, dead, blocked, extra),
    [source, dead, blocked, extra],
  );
  const path = route?.path ?? [];

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 7));
  }, []);

  // ---- route change detection: log it, and raise the alarm on loss --------
  const prevRoute = useRef<{ source: string; route: typeof route }>({ source, route });
  useEffect(() => {
    const prev = prevRoute.current;
    prevRoute.current = { source, route };
    if (prev.source !== source) return;
    const sig = (r: typeof route) => (r ? r.path.join(">") : "none");
    if (sig(prev.route) === sig(route)) return;
    pushLog(describeChange(prev.route, route));
    if (prev.route && !route) {
      playAlert();
      vibrate([200, 100, 200, 100, 400]);
    }
  }, [route, source, pushLog]);

  // ---- slider / toggle plumbing -------------------------------------------
  useEffect(() => {
    settings.current.gravity = gravity;
  }, [gravity]);
  useEffect(() => {
    settings.current.quakeIntensity = intensity;
  }, [intensity]);
  useEffect(() => {
    settings.current.timeScale = slowMo ? SLOWMO_SCALE : 1;
  }, [slowMo]);
  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  // ---- events coming from the physics scene -------------------------------
  const applyingRemote = useRef(false);
  const handleCollapse = useCallback(
    (spec: BuildingSpec) => {
      // Tell the other devices (unless this collapse was itself ordered by one).
      if (!applyingRemote.current) sendSync({ type: "collapse", id: spec.id });
      const now = performance.now();
      if (now - lastSound.current > 250) {
        lastSound.current = now;
        playCollapse(spec.kind === "scenery" ? 0.45 : 0.8);
        vibrate([80, 40, 160]);
      }
      if (spec.nodeId) {
        setDead((prev) => (prev.has(spec.nodeId!) ? prev : new Set(prev).add(spec.nodeId!)));
        pushLog(`${nodeName(spec.nodeId)} tower collapsed. Node is down.`);
      } else if (apiRef.current?.isQuaking()) {
        // During a quake dozens of buildings fall; summarise instead of spamming.
        if (spec.kind === "landmark") quakeStats.current.landmarks++;
        else quakeStats.current.scenery++;
      } else {
        pushLog(spec.kind === "landmark" ? "A tall building collapsed." : "A building collapsed.");
      }
    },
    [pushLog],
  );

  const handleQuakeChange = useCallback(
    (active: boolean) => {
      setQuaking(active);
      if (!active) {
        const { scenery, landmarks } = quakeStats.current;
        quakeStats.current = { scenery: 0, landmarks: 0 };
        if (scenery + landmarks > 0) {
          pushLog(`Earthquake over: ${landmarks} tall and ${scenery} other buildings fell.`);
        }
      }
    },
    [pushLog],
  );

  const handleImpact = useCallback(() => playImpact(), []);

  const handleDronePhase = useCallback(
    (phase: DronePhase, pair: RelayPair | null) => {
      setDronePhase(phase);
      if (phase === "relay" && pair) {
        pushLog(`Drone relaying between ${nodeName(pair.a)} and ${nodeName(pair.b)}.`);
      }
    },
    [pushLog],
  );

  // ---- clicks in the 3D scene ---------------------------------------------
  function handleWorldClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    unlockAudio();
    const api = apiRef.current;
    if (!api) return;

    if (modeRef.current === "shoot") {
      // Start slightly in front of the ray origin so the ball never spawns inside a mesh.
      const dir = e.ray.direction.clone().normalize();
      const origin = e.ray.origin.clone().addScaledVector(dir, 1.5);
      api.shoot(origin, e.point.clone());
      sendSync({ type: "shoot", origin: origin.toArray(), target: e.point.toArray() });
      return;
    }

    const id = e.object.userData?.buildingId as string | undefined;
    const spec = id ? buildBuildings().find((b) => b.id === id) : undefined;
    if (!spec) {
      // Cardboard has no joystick: gazing at the ground and tapping moves you there.
      if (view === "cardboard") setViewpoint([e.point.x, e.point.z]);
      return;
    }

    if (modeRef.current === "source") {
      if (!spec.nodeId) return;
      if (dead.has(spec.nodeId)) {
        pushLog(`${nodeName(spec.nodeId)} is down and cannot be a source.`);
        return;
      }
      setSource(spec.nodeId);
      sendSync({ type: "source", nodeId: spec.nodeId });
      const r = computeRoute(spec.nodeId, dead, blocked, extra);
      pushLog(
        r
          ? `Source set to ${nodeName(spec.nodeId)}: ${r.hops} hops to the gateway.`
          : `Source set to ${nodeName(spec.nodeId)}: no route to the gateway.`,
      );
      return;
    }

    // destroy / restore
    const result = api.toggleBuilding(spec.id);
    if (result === "rebuilt") {
      sendSync({ type: "rebuild", id: spec.id });
      if (spec.nodeId) {
        setDead((prev) => {
          const next = new Set(prev);
          next.delete(spec.nodeId!);
          return next;
        });
        pushLog(`${nodeName(spec.nodeId)} restored.`);
      } else {
        pushLog("Building rebuilt.");
      }
    }
    // "demolished" is reported through handleCollapse
  }

  function startQuake(broadcast = true) {
    unlockAudio();
    if (apiRef.current?.isQuaking()) return;
    quakeStats.current = { scenery: 0, landmarks: 0 };
    apiRef.current?.startQuake();
    if (broadcast) sendSync({ type: "quake" });
    pushLog("Earthquake started.");
  }

  function reset(broadcast = true) {
    if (broadcast) sendSync({ type: "reset" });
    apiRef.current?.resetAll();
    setDead(initialDeadNodes());
    setSource(SOURCE_DEFAULT);
    setBlocked(new Set());
    setLog(["Scene reset."]);
  }

  async function enterVr() {
    unlockAudio();
    try {
      await xrStore.enterVR();
    } catch (err) {
      console.error("enterVR failed", err);
      pushLog(`Could not start a VR session here (${err instanceof Error ? err.message : "unknown error"}). Try Cardboard on a phone.`);
    }
  }

  async function enterCardboard() {
    unlockAudio();
    const ok = await requestGyroPermission();
    if (!ok) pushLog("Gyroscope not available: the view will not follow your head.");
    setView("cardboard");
    try {
      await document.documentElement.requestFullscreen?.();
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch {
      // fullscreen / orientation lock are best effort
    }
  }

  function exitCardboard() {
    setView("desktop");
    if (document.fullscreenElement) void document.exitFullscreen();
  }

  const immersive = inVr || view === "cardboard";

  // ---- multi-device sync (see vr/sync.ts) -----------------------------------
  // Settings (gravity, quake strength, slow motion, drone) are sent whenever
  // they differ from what the other devices last told us.
  const lastSynced = useRef({
    gravity: DEFAULT_SETTINGS.gravity,
    intensity: DEFAULT_SETTINGS.quakeIntensity,
    slowMo: false,
    droneOn: true,
  });
  useEffect(() => {
    const cur = { gravity, intensity, slowMo, droneOn };
    const last = lastSynced.current;
    if (cur.gravity !== last.gravity || cur.intensity !== last.intensity || cur.slowMo !== last.slowMo || cur.droneOn !== last.droneOn) {
      lastSynced.current = cur;
      sendSync({ type: "settings", ...cur });
    }
  }, [gravity, intensity, slowMo, droneOn]);

  // Latest handler, so the subscription below never goes stale.
  const onRemote = useRef<(m: SyncMessage) => void>(() => {});
  onRemote.current = (m) => {
    const api = apiRef.current;
    if (!api) return;
    const remote = (fn: () => void) => {
      applyingRemote.current = true;
      try {
        fn();
      } finally {
        applyingRemote.current = false;
      }
    };
    const applySettings = (v: SyncMessage) => {
      if (v.gravity === undefined) return;
      lastSynced.current = { gravity: v.gravity, intensity: v.intensity!, slowMo: !!v.slowMo, droneOn: !!v.droneOn };
      setGravity(v.gravity);
      setIntensity(v.intensity!);
      setSlowMo(!!v.slowMo);
      setDroneOn(!!v.droneOn);
    };
    switch (m.type) {
      case "hello":
        sendSync({
          type: "state",
          ids: api.collapsedIds(),
          dead: Array.from(deadRef.current),
          nodeId: sourceRef.current,
          gravity: settings.current.gravity,
          intensity: settings.current.quakeIntensity,
          slowMo: settings.current.timeScale < 1,
          droneOn: droneRef.current,
        });
        break;
      case "state":
        remote(() => (m.ids ?? []).forEach((id) => api.demolish(id)));
        if (m.dead) setDead(new Set(m.dead));
        if (m.nodeId) setSource(m.nodeId);
        applySettings(m);
        pushLog("Synced with the other device.");
        break;
      case "collapse":
        if (m.id) remote(() => api.demolish(m.id!));
        break;
      case "rebuild":
        if (m.id) {
          api.rebuild(m.id);
          const spec = buildBuildings().find((b) => b.id === m.id);
          if (spec?.nodeId) {
            setDead((prev) => {
              const next = new Set(prev);
              next.delete(spec.nodeId!);
              return next;
            });
            pushLog(`${nodeName(spec.nodeId)} restored (other device).`);
          }
        }
        break;
      case "shoot":
        if (m.origin && m.target) api.shoot(new THREE.Vector3(...m.origin), new THREE.Vector3(...m.target));
        break;
      case "quake":
        startQuake(false);
        break;
      case "reset":
        reset(false);
        break;
      case "source":
        if (m.nodeId) setSource(m.nodeId);
        break;
      case "settings":
        applySettings(m);
        break;
    }
  };

  useEffect(() => {
    const off = subscribeSync((m) => onRemote.current(m), setSyncOn);
    // Ask the other devices for their state once the physics world is ready.
    const timer = setInterval(() => {
      if (apiRef.current) {
        clearInterval(timer);
        sendSync({ type: "hello" });
      }
    }, 500);
    return () => {
      clearInterval(timer);
      off();
    };
  }, []);

  const hud: HudModel = {
    mode,
    quaking,
    slowMo,
    droneOn,
    sound,
    gravity,
    intensity,
    infoLines: [
      "SOS route",
      `From: ${nodeName(source)}`,
      route ? route.path.map(nodeName).join(" > ") : "No route to the gateway. Node is cut off.",
      route ? `${route.hops} hops, cost ${route.totalDistance.toFixed(1)}` : "",
      `Blocked links: ${blocked.size} | Drone: ${droneOn ? dronePhase : "off"}`,
      `Nodes alive: ${VR_NODES.length - dead.size} / ${VR_NODES.length}`,
    ].filter((l) => l !== ""),
    logLines: log,
    on: {
      mode: setMode,
      quake: () => startQuake(),
      slowMo: () => setSlowMo((v) => !v),
      drone: () => setDroneOn((v) => !v),
      gravity: (d) => setGravity((g) => Math.min(30, Math.max(1, Math.round((g + d) * 10) / 10))),
      intensity: (d) => setIntensity((v) => Math.min(2.5, Math.max(0.5, Math.round((v + d) * 10) / 10))),
      sound: () => {
        unlockAudio();
        setSound((v) => !v);
      },
      reset: () => reset(),
      exit: () => {
        if (view === "cardboard") exitCardboard();
        else void xrStore.getState().session?.end();
      },
    },
  };

  /** Scripted walk-through for presentations. Click "Stop demo" to cancel. */
  async function runDemo() {
    const token = ++demoToken.current;
    const alive = () => demoToken.current === token;
    const say = async (text: string, secs: number) => {
      if (!alive()) return;
      setDemoCaption(text);
      await new Promise((r) => setTimeout(r, secs * 1000));
    };
    const tower = (nodeId: string) => buildBuildings().find((b) => b.nodeId === nodeId)!;
    reset();
    unlockAudio();
    setMode("destroy");
    await new Promise((r) => setTimeout(r, 800));
    await say("1. The gold line is the SOS route from Peenya to the Cisco gateway, found by Dijkstra.", 5);
    if (alive()) {
      apiRef.current?.toggleBuilding("tower-hoskerehalli");
    }
    await say("2. Hoskerehalli Metro tower is destroyed. All its links go dead and the route heals around it.", 6);
    if (alive()) {
      const t = tower("vijayanagar");
      for (let i = 0; i < 3 && alive(); i++) {
        apiRef.current?.shoot(
          new THREE.Vector3(t.x + 16, 6, t.z + 10),
          new THREE.Vector3(t.x, 1.5, t.z),
        );
        sendSync({ type: "shoot", origin: [t.x + 16, 6, t.z + 10], target: [t.x, 1.5, t.z] });
        await new Promise((r) => setTimeout(r, 900));
      }
    }
    await say("3. Projectile hits: collision events, impact force, wall dents, joints breaking.", 6);
    if (alive()) startQuake();
    await say("4. Earthquake: ground shaking loads every joint. Weak buildings collapse, towers go offline.", 11);
    await say("5. Blocked or broken links turn red. The relay drone flies in to bridge cut-off nodes.", 7);
    await say("Demo finished. Try it yourself: Shoot, Earthquake, gravity slider, or Reset.", 4);
    if (alive()) setDemoCaption(null);
  }

  function stopDemo() {
    demoToken.current++;
    setDemoCaption(null);
  }

  const modeLabel: Record<Mode, string> = {
    destroy: "Destroy / restore",
    source: "Set SOS source",
    shoot: "Shoot",
  };

  return (
    <div className="relative h-screen w-screen" style={{ background: "#111110" }}>
      <Canvas camera={{ position: [0, 38, 62], fov: 55 }} shadows={highQuality} dpr={[1, 2]}>
        <XR store={xrStore}>
        {/* Dusk sky: a procedural sky shader, no image files */}
        <Sky
          distance={4500}
          sunPosition={night ? [60, -8, -70] : [60, 16, -70]}
          turbidity={night ? 2 : 7}
          rayleigh={night ? 0.2 : 1.6}
          mieCoefficient={0.006}
          mieDirectionalG={0.85}
        />
        <fog attach="fog" args={night ? ["#0b1020", 60, 190] : ["#b9a99a", 80, 210]} />
        <hemisphereLight args={night ? ["#3a4a7a", "#10141c", 0.35] : ["#bcd0ff", "#4a4036", 0.6]} />
        <directionalLight
          position={[45, 40, 30]}
          intensity={night ? 0.45 : 1.7}
          color={night ? "#8fa8ff" : "#ffd9b0"}
          castShadow={highQuality}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-55}
          shadow-camera-right={55}
          shadow-camera-top={55}
          shadow-camera-bottom={-55}
          shadow-camera-near={10}
          shadow-camera-far={140}
          shadow-bias={-0.0004}
        />

        {/* Everything that shakes during a quake lives in this group. */}
        <group ref={shakeGroup} onClick={handleWorldClick}>
          <TeleportTarget onTeleport={(p) => setViewpoint([p.x, p.z])}>
            <Terrain />
          </TeleportTarget>
          <Suspense fallback={null}>
            {/* paused: we step the world ourselves (see DestructionLayer) */}
            <Physics paused gravity={[0, -DEFAULT_SETTINGS.gravity, 0]}>
              <DestructionLayer
                settings={settings}
                dead={dead}
                night={night}
                shakeGroup={shakeGroup}
                apiRef={apiRef}
                onCollapse={handleCollapse}
                onBlockedChange={setBlocked}
                onQuakeChange={handleQuakeChange}
                onImpact={handleImpact}
              />
            </Physics>
          </Suspense>
          <Links path={path} dead={dead} blocked={blocked} />
          <Packets path={path} />
          <SourceRing source={source} />
          <NodeLabels dead={dead} source={source} />
        </group>

        <DroneActor
          dead={dead}
          blocked={blocked}
          settings={settings}
          enabled={droneOn}
          onLink={setDroneLink}
          onPhase={handleDronePhase}
        />

        {!immersive && <Intro />}
        {!immersive && (
          <OrbitControls
            target={[0, 0, 0]}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={8}
            maxDistance={120}
            autoRotate={demoCaption !== null}
            autoRotateSpeed={0.6}
          />
        )}

        {/* Headset session (VR) and the HUD that lives in the world */}
        <VrRig viewpoint={viewpoint} hud={hud} showHud={view === "cardboard"} />
        {view === "cardboard" && <CardboardRig viewpoint={viewpoint} />}
        </XR>
      </Canvas>

      {view === "cardboard" && (
        <button
          onClick={exitCardboard}
          className="absolute left-1/2 top-2 -translate-x-1/2 rounded border px-3 py-1 text-xs text-[#e8e4da]"
          style={{ ...PANEL }}
        >
          Exit Cardboard
        </button>
      )}

      {demoCaption && !immersive && (
        <div
          className="pointer-events-none absolute bottom-44 left-1/2 w-[34rem] max-w-[90vw] -translate-x-1/2 rounded-md px-4 py-3 text-center text-base text-[#e8e4da]"
          style={PANEL}
        >
          {demoCaption}
        </div>
      )}

      {/* DOM HUD (desktop only: a headset only shows the canvas) */}
      {!immersive && <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-sm text-[#e8e4da]">
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto rounded-md p-3" style={PANEL}>
            <div className="mb-2 text-base font-medium" style={{ color: GOLD }}>
              ResQNet 3D Mesh Simulator
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {(Object.keys(modeLabel) as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="rounded border px-2 py-1"
                  style={{
                    borderColor: mode === m ? GOLD : "rgba(255,255,255,0.2)",
                    color: mode === m ? GOLD : "#e8e4da",
                  }}
                >
                  {modeLabel[m]}
                </button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                onClick={() => startQuake()}
                disabled={quaking}
                className="rounded border px-2 py-1"
                style={{ borderColor: "#c2453d", color: quaking ? "#7a5a56" : "#e58b84" }}
              >
                {quaking ? "Shaking..." : "Earthquake"}
              </button>
              <button
                onClick={() => setSlowMo((v) => !v)}
                className="rounded border px-2 py-1"
                style={{ borderColor: slowMo ? GOLD : "rgba(255,255,255,0.2)", color: slowMo ? GOLD : undefined }}
              >
                Slow motion
              </button>
              <button
                onClick={() => setDroneOn((v) => !v)}
                className="rounded border px-2 py-1"
                style={{ borderColor: droneOn ? GOLD : "rgba(255,255,255,0.2)", color: droneOn ? GOLD : undefined }}
              >
                Relay drone
              </button>
              <button
                onClick={() => {
                  unlockAudio();
                  setSound((v) => !v);
                }}
                className="rounded border px-2 py-1"
                style={{ borderColor: sound ? GOLD : "rgba(255,255,255,0.2)", color: sound ? GOLD : undefined }}
              >
                Sound {sound ? "on" : "off"}
              </button>
              <button onClick={() => reset()} className="rounded border px-2 py-1" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                Reset
              </button>
              <button
                onClick={() => setNight((v) => !v)}
                className="rounded border px-2 py-1"
                style={{ borderColor: night ? GOLD : "rgba(255,255,255,0.2)", color: night ? GOLD : undefined }}
              >
                Night
              </button>
              <button
                onClick={demoCaption ? stopDemo : runDemo}
                className="rounded border px-2 py-1"
                style={{ borderColor: "#8ad0ff", color: "#8ad0ff" }}
              >
                {demoCaption ? "Stop demo" : "Run demo"}
              </button>
              <button
                onClick={enterVr}
                className="rounded border px-2 py-1"
                style={{ borderColor: GOLD, color: GOLD }}
              >
                Enter VR
              </button>
              <button
                onClick={enterCardboard}
                className="rounded border px-2 py-1"
                style={{ borderColor: GOLD, color: GOLD }}
              >
                Cardboard
              </button>
              <Link href="/simulation" className="rounded border px-2 py-1" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                2D view
              </Link>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <span className="w-24 opacity-80">Gravity {gravity.toFixed(1)}</span>
              <input
                type="range"
                min={1}
                max={30}
                step={0.1}
                value={gravity}
                onChange={(e) => setGravity(Number(e.target.value))}
              />
              <button className="underline opacity-70" onClick={() => setGravity(9.81)}>
                Earth
              </button>
            </label>
            <label className="mt-1 flex items-center gap-2 text-xs">
              <span className="w-24 opacity-80">Quake {intensity.toFixed(1)}</span>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="pointer-events-auto w-80 rounded-md p-3" style={PANEL}>
            <div className="mb-1 font-medium" style={{ color: GOLD }}>
              SOS route
            </div>
            <div className="text-xs opacity-80">From: {nodeName(source)}</div>
            {route ? (
              <>
                <div className="mt-1 text-xs">{route.path.map(nodeName).join("  >  ")}</div>
                <div className="mt-1 text-xs opacity-80">
                  {route.hops} hops, cost {route.totalDistance.toFixed(1)}
                </div>
              </>
            ) : (
              <div className="mt-1 text-xs" style={{ color: "#e58b84" }}>
                No route to the gateway. This node is cut off.
              </div>
            )}
            <div className="mt-2 text-xs opacity-80">
              Blocked links: {blocked.size} | Drone: {droneOn ? dronePhase : "off"}
              {droneLink ? ` (${nodeName(droneLink.a)} - ${nodeName(droneLink.b)})` : ""}
            </div>
            <div className="mt-1 text-xs opacity-60">
              Nodes alive: {VR_NODES.length - dead.size} / {VR_NODES.length}
            </div>
            <div className="mt-1 text-xs" style={{ color: syncOn ? "#6cf08a" : "#e58b84" }}>
              Multi-device sync: {syncOn ? "connected" : "offline"}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto max-w-xl rounded-md p-3" style={PANEL}>
          <div className="mb-1 font-medium" style={{ color: GOLD }}>
            Event log
          </div>
          {log.map((line, i) => (
            <div key={i} className="text-xs" style={{ opacity: i === 0 ? 1 : 0.6 }}>
              {line}
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}
