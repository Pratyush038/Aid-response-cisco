# ResQNet 3D/VR: Computer Graphics & VR Overview

Route: `/vr`. Course: CS373IA (Computer Graphics and Virtual Reality).
A short, one-page map of every CG/VR component in the project. For viva Q&A
and the syllabus mapping, see [CGVR-PROJECT.md](CGVR-PROJECT.md).

**What it is:** the ResQNet LoRa disaster mesh (13 nodes, 20 links) rendered as
a 3D city. You can orbit it, enter it in VR (headset or phone Cardboard),
shake the ground, shoot buildings, and watch Dijkstra re-route the SOS message
around what you destroyed.

---

## 1. Tools & stack

| Tool | Used for |
|---|---|
| three.js (0.169) | WebGL rendering, geometry, materials, cameras, raycasting |
| react-three-fiber + drei | Scene graph as React components, `OrbitControls`, `Line` |
| Rapier (`@react-three/rapier`) | Rigid-body stepping, joints, collision events |
| WebXR + `@react-three/xr` | Headset stereo, head pose, controllers |
| Web Audio API | Synthesised collapse/impact/alert sounds |
| `navigator.vibrate`, `deviceorientation` | Phone haptics, gyroscope head tracking |
| Canvas 2D API | Procedural textures (no image files) |
| Server-Sent Events (`server/vr-sync.ts`) | Multi-device sync |
| Vite, TypeScript, React 18 | Build and app shell |

---

## 2. Graphics components

### Rendering pipeline & scene
- three.js WebGL renderer: vertex transform, rasterisation and shading are done by the GPU; we supply geometry, materials, lights and cameras.
- Scale is **1 unit = 1 metre**; the layout is schematic (~60 units across).
- Lighting: ambient + directional light, `MeshStandardMaterial` (PBR, Phong-like).

### Geometric modelling
- **Terrain** (`scene/Terrain.tsx`): a subdivided plane whose vertices are displaced by `terrainHeight(x, z)` (`data.ts`); flat-shaded, normals recomputed.
- **Buildings** (`destruction.ts`, `data.ts`): each is a grid of blocks (2x2 columns, 2-8 layers) with a roof and an antenna mast. Five styles (industrial, residential, commercial, hospital, campus) differ in size, colour and roof.
- **Radio links** (`scene/Links.tsx`): lines between antenna tips. Gold = active route, teal = usable, red dashed = dead or blocked.

### Transformations
- Every block's mesh copies the rigid-body position and rotation each frame (`syncMeshes`).
- HUD panels and labels are rotated/scaled groups; billboards face the camera.
- Gyro orientation is composed with quaternions (`gyro.ts`) to avoid gimbal lock.

### Cameras & viewing
- Desktop: perspective camera + orbit controls, plus an **intro fly-down** (`scene/Intro.tsx`): ease-out lerp, `k = 1 - (1 - t)^3`, cancelled by any mouse press.
- VR: head pose from WebXR; the player rig is an origin object, so moving it is locomotion/teleport (`scene/VrRig.tsx`).
- Cardboard: two off-axis eye cameras via `THREE.StereoCamera`, eye separation 64 mm, rendered to left/right half-viewports (`scene/CardboardRig.tsx`). Lens distortion is not corrected.

### Texturing
- `textures.ts` draws wall textures and matching **emissive maps** (lit windows) per building style on a canvas, with a seeded linear-congruential RNG so patterns are deterministic and cached.
- `canvasText.ts`: text rendered to canvas, used for labels and HUD (`Labels.tsx`, `WorldHud.tsx`).
- `softDot` sprite texture for dust particles.

### Particles & effects
- **Dust** (`scene/Dust.tsx`): fixed pool of 900 points with position, velocity and life; drift upward, drag, fade out. Burst on impact/collapse.
- Glowing projectiles and impact dust on shots.
- **Surface deformation** (`dent.ts`): vertices within radius R of the impact are pushed along the ball direction by `depth * (1 - (r/R)^2)^2` (zero value and slope at the edge, so no crease). Depth grows with sqrt(impulse), capped. Visual only; colliders stay boxes.

### 3D UI
- World-space HUD with ray-clickable buttons (`WorldHud.tsx`) because the DOM is invisible in a headset.
- `noRaycast.ts` excludes decorative meshes from picking.

---

## 3. Physics (all in `vr/`)

| Topic | Model |
|---|---|
| Time stepping | Fixed step 1/60 s. Slow motion shrinks simulated time per step to x0.2 (smooth, not frame-skipping). |
| Gravity | World gravity vector set from the slider (1-30 m/s^2). |
| Joints | Neighbouring blocks and ground blocks are fixed joints with random strength. A joint breaks when load > strength. |
| Joint load | Quake term `a_eff = a_ground * (1 + 0.15 * layer)` and weight term `0.25 * g`, combined as `sqrt(a_eff^2 + (0.25 g)^2)`. |
| Earthquake (`quake.ts`) | Ground acceleration = sum of sinusoids x ramp-hold-decay envelope. Physics runs in the ground frame, so each block feels the fictitious force `F = -m * a_ground`. Drawing moves the world by the double integral of `a`, x7 for visibility; the camera stays still (avoids VR motion sickness). |
| Impact | Relative speed taken *before* the solver step. Impulse `J = m_red * v_rel * (1 + e)`, `m_red = m1 m2 / (m1 + m2)`. Force `F = J / 0.25 s`, compared with joint strength; neighbours get 10%. |
| Aim | Projectile aim compensates for gravity drop: `y += 0.5 * g * t^2`. |
| Collapse test | BFS from the ground through surviving joints; unreached blocks are detached. Building collapsed if >= 40% detached or the mast is. |
| Collision detection | Rapier collision events (blocks, ground, balls); pointer-ray picking (R3F). |
| Line of sight (`los.ts`) | `THREE.Raycaster` from antenna tip A to B, limited to |AB|; any block hit = link blocked. Re-evaluated a few times per second. |

**Radio/network link to graphics** (`mesh.ts`): a link is active only if both
endpoints are alive and the line of sight is clear. The unchanged
`lib/dijkstra.ts` then routes around the damage and `Links.tsx` recolours it.

---

## 4. Behaviour & interaction

- **Relay drone** (`drone.ts`, `scene/DroneActor.tsx`): state machine patrol -> relay -> cooldown; bridges a broken network.
- **Input:** mouse/touch, WebXR controller rays (trigger, thumbstick, teleport), gaze reticle + tap in Cardboard (event ray forced to screen centre).
- **Controls:** demolish/restore, set SOS source, shoot, earthquake, slow-mo, drone, sound, reset, gravity and quake sliders.
- **Audio/haptics** (`audio.ts`): Web Audio tones for collapse/impact/alert; phone vibration on collapse and route loss.
- **Multi-device sync** (`sync.ts`, `server/vr-sync.ts`): physics is local on each device; only *actions* and *collapse outcomes* are broadcast over SSE, so routing agrees everywhere even though physics is not bit-identical.

---

## 5. Three I's & five components (summary)

| | |
|---|---|
| **Immersion** | Stereo head-tracked rendering, 1:1 scale, world-space HUD, audio/haptics |
| **Interaction** | Point, shoot, demolish, quake, locomotion, live re-routing |
| **Imagination** | Visible radio links, what-if gravity/quake, slow motion, drone |
| **Input** | Mouse, touch, headset + controllers, gyroscope |
| **Output** | Monitor, headset stereo, split-screen Cardboard, audio, vibration |
| **VR engine** | three.js + R3F + Rapier + our destruction/quake/LOS/drone layers |
| **Software/data** | `data.ts` (nodes, links, terrain, building specs), `mesh.ts`, Dijkstra |
| **Task** | Keep an SOS path alive while the disaster destroys the network |

---

## 6. File map

```
client/src/vr/
  data.ts         nodes, links, terrain height, building styles/sizes
  destruction.ts  blocks, joints, loads, impacts, collapse test
  quake.ts        ground-motion model
  dent.ts         vertex dent deformation
  los.ts          raycast line of sight
  mesh.ts         link activity -> Dijkstra glue
  drone.ts        relay drone behaviour
  gyro.ts         phone orientation -> quaternion
  audio.ts        Web Audio + vibration
  textures.ts     procedural wall/window/dust textures
  canvasText.ts   text-to-texture
  settings.ts     gravity, time scale, quake intensity
  sync.ts         multi-device message types
  scene/          Terrain, DestructionLayer, Links, Labels, WorldHud, Dust,
                  DroneActor, Intro, VrRig, CardboardRig, noRaycast
server/vr-sync.ts SSE hub for multi-device sync
```

---

## 7. Not covered / limitations

- **Raster algorithms & 2D clipping** (line/circle drawing, polygon fill): the GPU/three.js do this; we did not implement them.
- Not tested on a real headset (emulated Quest 3 only); Cardboard gyro, vibration and controller locomotion untested on hardware.
- No Cardboard lens-distortion correction; no controller haptics.
- Quake/impact thresholds are hand-tuned, not calibrated to real structures.
- Night mode and roads/trees were tried and removed.
