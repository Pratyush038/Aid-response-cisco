# ResQNet 3D / VR Disaster-Mesh Simulator (route `/vr`)

Course: Computer Graphics and Virtual Reality (CS373IA), Semester VII.

ResQNet is a LoRa mesh network for disasters. The `/vr` route turns the network
into a 3D world you can look at, walk around in (headset or phone Cardboard),
and break: you can shake the ground, shoot buildings, destroy towers and watch
the routing algorithm (Dijkstra, `client/src/lib/dijkstra.ts`, unchanged)
heal around the damage.

How to run: `npm run dev`, open `http://localhost:3005/vr` (the port is the one
the dev server prints).

Controls on the desktop: left-drag orbits, wheel zooms. Buttons:
Destroy / restore, Set SOS source, Shoot (click a building or the ground),
Earthquake, Slow motion, Relay drone, Sound, Reset, sliders for gravity and
quake strength, Enter VR, Cardboard.

---

## 1. The three I's of VR

| I | Where it appears in the project | Exact features |
|---|---|---|
| Immersion | You are inside the scene, not looking at a picture of it. | Head-tracked stereo rendering through WebXR (`Enter VR`, `vr/scene/VrRig.tsx`). Phone Cardboard mode with two eye views and gyroscope head tracking (`vr/scene/CardboardRig.tsx`, `vr/gyro.ts`). Scale is 1 unit = 1 metre, so a tower is 6 m tall around you. In-world HUD panels and labels instead of a flat web page (`vr/scene/WorldHud.tsx`, `vr/scene/Labels.tsx`). The quake shakes the world, not the camera, to avoid motion sickness (`DestructionLayer.tsx`). Sound (Web Audio) and phone vibration on collapse (`vr/audio.ts`). |
| Interaction | The world responds to what you do, immediately. | Point and click to demolish or rebuild a building, choose the SOS source, or shoot (mouse, controller ray, or gaze reticle plus tap). Earthquake button. Gravity, quake-strength and slow-motion controls. Teleport and smooth locomotion with the controller sticks. Tapping the ground in Cardboard moves you there. Everything you break changes the radio links and the route, live. |
| Imagination | Things you cannot see or do in real life are made visible and playable. | Radio links drawn as lines (gold = active route, teal = usable, red dashed = dead or blocked). What-if gravity slider (1 to 30 m/s^2) and what-if quake strength. Slow motion to watch a collapse. A relay drone with its own behaviour that bridges a broken network (`vr/drone.ts`). A schematic city of 13 real ResQNet nodes. "What if this tower falls?" is answered by the route changing in front of you. |

---

## 2. The five components of a VR system

| Component | In this project |
|---|---|
| Input devices | Mouse (desktop), VR headset pose and the two controllers' ray, trigger and thumbsticks (WebXR through `@react-three/xr`), phone gyroscope through the `deviceorientation` event (`vr/gyro.ts`), phone touch (tap = select under the reticle). |
| Output devices | Display: monitor, headset stereo displays, or the phone screen split in two for Cardboard. Audio: synthesised sounds (`vr/audio.ts`). Haptic: `navigator.vibrate` on phones (not on headsets or desktops). |
| VR engine | three.js for rendering, react-three-fiber for the scene graph, Rapier for rigid-body stepping. Our own engine layer on top: the fixed-step loop and time scaling (`scene/DestructionLayer.tsx`), the destruction system (`vr/destruction.ts`), line of sight (`vr/los.ts`), quake model (`vr/quake.ts`), drone behaviour (`vr/drone.ts`). |
| Software and databases | `vr/data.ts` (13 nodes, 20 links copied from `seed-db.ts`, terrain function, building specifications), `vr/mesh.ts` (glue to Dijkstra), `lib/dijkstra.ts` (unchanged routing). There is no live database in the 3D scene: the world is built from the seed data. |
| The task | Keep an SOS message routed from a source node to the Cisco gateway while the disaster destroys nodes and blocks radio paths, and let the user explore how resilient the mesh is. |

---

## 3. Syllabus map

I did not have the official syllabus document when writing this. The unit
titles below are my assumption from the usual structure of this subject and
from the topics named in the project brief (Unit V: collision detection, force
computation, surface deformation, haptic feedback, behaviour model). Please
check each row against your syllabus before the viva and rename rows if needed.

### Unit I: Introduction (graphics pipeline, VR basics, three I's, components)

| Topic | File and feature |
|---|---|
| Three I's of VR | Section 1 of this document. |
| Components of a VR system | Section 2 of this document. |
| Graphics rendering pipeline in use | three.js WebGL renderer drawing `Terrain.tsx`, the blocks and the sprites each frame. |
| Applications of VR (disaster training, simulation) | The whole `/vr` page: disaster mesh what-if simulator. |

### Unit II: Geometric modelling, transformations, viewing

| Topic | File and feature |
|---|---|
| Geometric modelling | Terrain as a subdivided plane displaced by a height function (`scene/Terrain.tsx`, `terrainHeight` in `vr/data.ts`). Buildings as boxes split into a block grid (`vr/destruction.ts`, `addBuilding`). Mesh generation of the physics ground (`buildGround`). |
| 3D transformations | Position, rotation and scale of every block, group and panel. Block meshes copy the rigid-body pose each frame (`syncMeshes`). HUD panels are rotated and scaled groups (`WorldHud.tsx`). The gyroscope maths composes quaternions (`vr/gyro.ts`). |
| Viewing, projection, camera | Perspective camera (OrbitControls on desktop), the head pose in VR, and two off-axis eye cameras for Cardboard (`THREE.StereoCamera`, eye separation 64 mm, `CardboardRig.tsx`). |
| Texture mapping | Canvas-drawn text used as textures for labels and HUD (`vr/canvasText.ts`). |
| Lighting and shading | Ambient plus directional light, standard (Phong-like PBR) material, flat-shaded terrain (`pages/vr.tsx`, `Terrain.tsx`). Normals recomputed after a dent (`computeVertexNormals` in `destruction.ts`). |

### Unit III: Raster algorithms and 2D clipping

NOT covered by this project. The project does not implement line or circle
rasterisation, polygon filling, or 2D clipping. three.js and the GPU do the
rasterisation. Do not claim this unit in the viva.

### Unit IV: VR hardware and interaction (input and output devices, tracking, stereo)

| Topic | File and feature |
|---|---|
| Head tracking | WebXR headset pose (`VrRig.tsx`); phone gyroscope (`vr/gyro.ts`). |
| Stereoscopic display | Headset: the browser renders both eyes. Cardboard: our own two-viewport render using `StereoCamera` (`CardboardRig.tsx`). Missing: lens distortion correction. |
| Input devices and pointing | Controller ray pointers, trigger select, thumbstick locomotion, teleport (`VrRig.tsx`, store option `teleportPointer`). Gaze pointing in Cardboard: the event ray is forced to the screen centre (`CardboardRig.tsx`). |
| Output devices | Display modes above, audio and vibration (`vr/audio.ts`). |
| 3D user interface | World-space HUD with ray-clickable buttons (`WorldHud.tsx`), billboard labels (`Labels.tsx`). |

### Unit V: Physical simulation and behaviour in VR

| Topic | File and feature |
|---|---|
| Collision detection | Rapier collision events between colliders (blocks, ground, balls), drained each step in `Destruction.step` and handled in `handleContact`. Line-of-sight ray casting with `THREE.Raycaster` (`vr/los.ts`). Picking by pointer ray (R3F events). |
| Force computation | Impact impulse `J = m_reduced * v_rel * (1 + e)` and force `F = J / contact time` (`handleContact`, `impactOnBlock` in `vr/destruction.ts`). Joint load from quake and gravity (`Destruction.step`). Fictitious force `-m * a_ground` for the shaking frame. |
| Rigid-body dynamics | Rapier steps the bodies; we choose masses, joints, fixed time step and time scale (slow motion). |
| Breaking and fracture (pre-fractured) | Block grids per building, fixed joints with random strength, joint removal when the load exceeds the strength (`destruction.ts`). Connectivity search to decide what has fallen (`updateIntegrity`). |
| Surface deformation | Vertex dent in the wall of the struck block (`vr/dent.ts`, `dentBlock`). Visual only. |
| Haptic feedback | Phone vibration on collapse and route loss (`vibrate` in `vr/audio.ts`, called from `pages/vr.tsx`). Only where `navigator.vibrate` exists. Controller haptics are not implemented. |
| Behaviour model | Relay drone state machine (patrol, relay, cooldown), `vr/drone.ts` and `scene/DroneActor.tsx`. |
| Sound | Collapse, impact and alert tones generated with the Web Audio API (`vr/audio.ts`). |

---

## 4. Likely viva questions

1. **Why does the route change when a tower is destroyed? Your Dijkstra never looks at node status.**
   Right, `NetworkGraph` only reads `connection.isActive`. So `buildGraphInputs` in `vr/mesh.ts` computes `isActive` for every link: both endpoints must be alive and the line of sight must be clear. A dead node therefore has all its links off, and Dijkstra routes around it. I also guard the start-equals-end case, because Dijkstra returns a zero-hop route there without checking that the node is alive.

2. **How do you decide that a building blocks a radio link?**
   `vr/los.ts` casts a `THREE.Raycaster` ray from one antenna tip to the other, limited to the distance between them, against all block meshes. Any hit means blocked. It runs a few times per second, so when a building falls the link comes back, and when debris lands in the way a link can drop.

3. **What does "pre-fractured" mean and why not break the building at run time?**
   Each building is cut into a grid of blocks in advance (2 by 2 columns, 2 to 8 layers). Run-time fracture needs geometry cutting and is expensive and unstable. With pre-cut blocks I only need to remove joints between them, which is cheap and predictable.

4. **When does a joint break?**
   Every neighbouring pair of blocks and every ground block has a fixed joint with a random strength. Each step I compute a load: quake acceleration times a height factor `1 + 0.15 * layer`, combined with a weight term `0.25 * g`. If the load exceeds the joint strength, I remove the joint. Impacts add a force that is compared with strength times the mass the joint supports.

5. **How is the earthquake modelled?**
   Ground acceleration is a sum of a few sinusoids under a ramp-hold-decay envelope (`vr/quake.ts`). Physics runs in the ground's frame, so each block gets the fictitious force minus mass times ground acceleration. For drawing, I move the whole world group by the double integral of the acceleration, multiplied by 7 so it is visible. The camera does not move, because moving it makes people sick in VR.

6. **How do you compute the force of a projectile hit?**
   On a collision event I take the relative speed from before the step, because after the solver runs the body has already slowed down. The impulse is `J = m_reduced * v * (1 + e)`, with reduced mass `m1 m2 / (m1 + m2)`. I treat the contact as lasting 0.25 s, so `F = J / 0.25`, and compare it with each joint's strength. Neighbouring blocks get 10 percent of that force.

7. **How does the dent work?**
   The block mesh has several segments per side, so its walls have vertices. I find the impact point in the block's local space and push every vertex within a radius R along the ball's direction by `depth * (1 - (r/R)^2)^2`. This function and its slope are zero at the edge, so there is no crease. Depth grows with the square root of the impulse and is capped. The physics collider stays a box, so the dent is only visual.

8. **How does a collapsed building turn into a dead node?**
   After joints break I search from the ground through the remaining joints (breadth-first). Blocks that are not reached are detached. If at least 40 percent of the blocks are detached, or the antenna mast is, the building has collapsed. A tower collapse calls back into the page, which adds the node to the dead set, and Dijkstra reroutes.

9. **What does the physics library do and what did you write?**
   Rapier integrates bodies, detects collisions and keeps jointed bodies together. I wrote the building and joint layout, the load and strength model, the quake, the impact force, the dent, the connectivity test, the line of sight, the routing glue and the drone. The libraries are dependencies for rendering and rigid-body stepping only.

10. **How do slow motion and the gravity slider work?**
    The physics runs with a fixed step of one sixtieth of a second. For slow motion I shrink the simulated time of each step to a fifth, so it stays smooth instead of skipping frames. The gravity slider sets the world's gravity vector, which changes how fast things fall and, through the weight term, how hard the joints are loaded. At very high gravity weak buildings fail without any quake.

11. **How does VR mode work?**
    The browser's WebXR API gives a session. Each frame the headset reports the head pose and the browser renders two eye views. `@react-three/xr` attaches the camera to an origin object that represents the player's feet, so moving that object is locomotion and teleport. Controllers give rays that act as pointers for the same click handlers the mouse uses. The HUD is a set of textured planes parented to the origin, because the DOM is not visible in a headset.

12. **How does the phone Cardboard mode work, and what is missing?**
    I render the scene twice, into the left and right halves of the screen, from two cameras 64 mm apart (`THREE.StereoCamera`). The phone's gyroscope angles are converted to a camera rotation quaternion. A tap selects what is under the centre reticle, because I force the pointer ray to the screen centre. What is missing is the lens distortion correction, so edges look slightly warped, and I could only test it without real sensor data.

---

## 5. Known limitations

- Not tested on a real headset. The headset session was tested only with an emulated Meta Quest 3 (IWER) in a desktop browser.
- Cardboard head tracking with a real phone gyroscope and the tap-to-select path were not tested.
- Teleport, thumbstick locomotion and snap turning are wired up but were not exercised.
- Phone vibration was not tested (needs an Android phone).
- Cardboard has no lens distortion correction.
- The dent is visual only; colliders stay boxes.
- Quake and impact thresholds are tuned by hand, not calibrated to real structures. Results have a sharp threshold: slightly stronger shaking makes many towers fall at once.
- Layout is schematic (about 60 units across), not to geographic scale. Routing still uses the real distances and latencies from the seed data.
- Unit III (raster algorithms, 2D clipping) is not covered.
