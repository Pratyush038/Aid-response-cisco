// Destructible buildings on top of the Rapier rigid-body engine.
//
// What Rapier does for us (library): integrate rigid bodies, detect
// collisions, resolve contacts, keep jointed bodies together.
//
// What this file does (our own logic):
//   * pre-fractured buildings: a grid of blocks per building, fixed in data.ts
//   * a joint between every pair of neighbouring blocks, and between the
//     bottom blocks and the ground
//   * a LOAD model for every joint and a STRENGTH per joint; when load exceeds
//     strength we delete the joint, so the pieces separate and fall
//   * collision events turned into impact forces
//   * connectivity analysis: which blocks are still tied to the ground?
//   * the visual dent on the wall that a projectile hits
//
// Load model (units: acceleration, so it does not depend on block size)
// -------------------------------------------------------------------
//   quake load   a_eff = |a_ground| * (1 + 0.15 * layer)
//                Upper floors swing further than the base, so they see more
//                acceleration ("whip effect"). layer 0 is the ground floor.
//   weight load  0.25 * g
//                Gravity matters mostly for the what-if slider: at 9.81 this
//                is far below every strength, at 30 it starts to tear weak
//                joints apart.
//   combined     load = sqrt(a_eff^2 + (0.25 g)^2)
//   break when   load > capacity            (capacity is random per joint)
//
//   impact load  F = J / CONTACT_TIME, with J = m_reduced * v_rel * (1 + e)
//                compared with  capacity * m_supported.
//
// m_supported is the mass a joint has to hold up: the block above it and the
// whole column of blocks stacked on top of that block.

import * as THREE from "three";
import type {
  Collider,
  EventQueue,
  ImpulseJoint,
  RigidBody,
  World,
} from "@dimforge/rapier3d-compat";
import {
  BODY_HEIGHT,
  GROUND_OFFSET,
  MAST_HEIGHT,
  baseHeight,
  mulberry32,
  terrainHeight,
  type BuildingSpec,
} from "./data";
import { applyDent, dentDepth } from "./dent";
import { buildingTextures, softDot } from "./textures";

type Rapier = typeof import("@dimforge/rapier3d-compat").default;

// ---- tunable constants -----------------------------------------------------

/** Share of a building's blocks that may detach before it counts as collapsed. */
const COLLAPSE_FRACTION = 0.4;
/** Pretend an impact lasts this long: F = J / CONTACT_TIME. */
const CONTACT_TIME = 0.25;
/** Bounciness used in J = m v (1 + e). */
const RESTITUTION = 0.2;
/** Impacts slower than this (units/s) are ignored: resting and sliding contact. */
const MIN_IMPACT_SPEED = 4;
/** Fraction of an impact force that reaches the joints of the neighbours. */
const NEIGHBOUR_FALLOFF = 0.1;
/** Gravity's contribution to the joint load (see header). */
const WEIGHT_FACTOR = 0.25;
/** Collider is a bit smaller than the drawn block so neighbours never touch. */
const COLLIDER_SHRINK = 0.97;
/** Mesh subdivisions per axis, so walls have vertices to dent. */
const SEGMENTS = 4;

const BASE_CAPACITY = { ground: 7.5, vertical: 7.0, horizontal: 6.5, mast: 10.0 };

const IDENT = { x: 0, y: 0, z: 0, w: 1 };

// ---- data structures -------------------------------------------------------

type JointKind = keyof typeof BASE_CAPACITY;

interface JointRec {
  kind: JointKind;
  a: Block | null; // null = ground
  b: Block;
  /** Mass this joint must support, and its random strength (acceleration). */
  mSup: number;
  capacity: number;
  /** 1 + 0.15 * layer, see header. */
  layerFactor: number;
  bodyA: RigidBody;
  anchorA: { x: number; y: number; z: number };
  anchorB: { x: number; y: number; z: number };
  handle: ImpulseJoint | null;
}

export interface Block {
  id: number;
  building: Building;
  layer: number;
  isMast: boolean;
  half: THREE.Vector3;
  mass: number;
  body: RigidBody;
  collider: Collider;
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  joints: JointRec[];
  originalPositions: Float32Array;
  attached: boolean;
}

export interface Building {
  spec: BuildingSpec;
  blocks: Block[];
  joints: JointRec[];
  collapsed: boolean;
  detached: number;
}

interface Ball {
  body: RigidBody;
  collider: Collider;
  mesh: THREE.Mesh;
  mass: number;
  age: number;
}

export interface DestructionEnv {
  gravity: number;
  /** Ground acceleration [ax, az], m/s^2. */
  quake: [number, number];
}

export interface DestructionCallbacks {
  onCollapse?: (b: Building) => void;
  onJointsBroken?: (count: number) => void;
  /** Called for impacts that damaged a building; `speed` is the relative speed. */
  onImpact?: (speed: number) => void;
}

function isBall(x: Block | Ball): x is Ball {
  return "age" in x;
}

// ---- the system ------------------------------------------------------------

export class Destruction {
  readonly group = new THREE.Group();
  readonly buildings: Building[] = [];
  /** Block meshes that can obstruct a radio link (masts are too thin to count). */
  readonly obstacles: THREE.Mesh[] = [];
  callbacks: DestructionCallbacks = {};

  private blocks: Block[] = [];
  private balls: Ball[] = [];
  private byCollider = new Map<number, Block | Ball>();
  private groundCollider: Collider | null = null;
  private ground!: RigidBody;
  private prevVel = new Map<Block | Ball, THREE.Vector3>();
  private queue: EventQueue;
  private dirty = new Set<Building>();
  private brokenThisStep = 0;
  private lamps = new Map<string, THREE.MeshStandardMaterial>();
  private halos = new Map<string, THREE.SpriteMaterial>();
  private rand = mulberry32(777);
  private tmp = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  constructor(
    private R: Rapier,
    private world: World,
    specs: BuildingSpec[],
  ) {
    this.queue = new R.EventQueue(true);
    this.buildGround();
    for (const s of specs) this.addBuilding(s);
  }

  // ---- construction --------------------------------------------------------

  private buildGround() {
    const R = this.R;
    // Physics ground = visual terrain lowered by GROUND_OFFSET (see data.ts).
    const n = 60;
    const size = 90;
    const verts = new Float32Array((n + 1) * (n + 1) * 3);
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = (i / n - 0.5) * size;
        const z = (j / n - 0.5) * size;
        const k = (j * (n + 1) + i) * 3;
        verts[k] = x;
        verts[k + 1] = terrainHeight(x, z) - GROUND_OFFSET;
        verts[k + 2] = z;
      }
    }
    const idx = new Uint32Array(n * n * 6);
    let p = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        const b = a + 1;
        const c = a + (n + 1);
        const d = c + 1;
        idx[p++] = a;
        idx[p++] = c;
        idx[p++] = b;
        idx[p++] = b;
        idx[p++] = c;
        idx[p++] = d;
      }
    }
    this.ground = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.groundCollider = this.world.createCollider(
      R.ColliderDesc.trimesh(verts, idx)
        .setFriction(0.9)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      this.ground,
    );
  }

  private addBuilding(spec: BuildingSpec) {
    const R = this.R;
    const rand = mulberry32(spec.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const building: Building = { spec, blocks: [], joints: [], collapsed: false, detached: 0 };
    this.buildings.push(building);

    const baseY = baseHeight(spec.x, spec.z, spec.w, spec.d);
    const bw = spec.w / spec.nx;
    const bh = spec.h / spec.ny;
    const bd = spec.d / spec.nz;
    const half = new THREE.Vector3(bw / 2, bh / 2, bd / 2);

    // Per-building strength: engineered towers are sturdier, old tall
    // landmarks weaker, scenery varies. Without this every building of a kind
    // would fail at the same shaking level and the quake would be all-or-nothing.
    const strength =
      spec.kind === "tower" ? 1.0 + 1.5 * rand() : spec.kind === "landmark" ? 0.85 : 0.7 + 0.8 * rand();

    const color =
      spec.kind === "tower" ? "#f2eee4" : spec.kind === "landmark" ? "#aeb8c8" : "#d8cdbd";

    // grid[layer][ix][iz]
    const grid: Block[][][] = [];
    for (let ly = 0; ly < spec.ny; ly++) {
      grid[ly] = [];
      for (let ix = 0; ix < spec.nx; ix++) {
        grid[ly][ix] = [];
        for (let iz = 0; iz < spec.nz; iz++) {
          const cx = spec.x - spec.w / 2 + bw * (ix + 0.5);
          const cy = baseY + bh * (ly + 0.5);
          const cz = spec.z - spec.d / 2 + bd * (iz + 0.5);
          const tex = buildingTextures();
          const mat = new THREE.MeshStandardMaterial({
            // colour multiplies the window texture: it tints each building
            color: new THREE.Color(color).offsetHSL(0, 0, (rand() - 0.5) * 0.08),
            map: tex.map,
            emissiveMap: tex.emissive,
            emissive: new THREE.Color("#ffffff"),
            emissiveIntensity: 0.9,
            roughness: 0.85,
          });
          const geo = new THREE.BoxGeometry(bw, bh, bd, SEGMENTS, SEGMENTS, SEGMENTS);
          const blk = this.makeBlock(building, ly, half, new THREE.Vector3(cx, cy, cz), geo, mat, false);
          grid[ly][ix][iz] = blk;
        }
      }
    }

    // Column mass: this block plus everything stacked above it.
    const colMass = (ly: number, ix: number, iz: number) => {
      let m = 0;
      for (let k = ly; k < spec.ny; k++) m += grid[k][ix][iz].mass;
      return m;
    };

    const addJoint = (
      kind: JointKind,
      a: Block | null,
      b: Block,
      mSup: number,
      layer: number,
      anchorA: THREE.Vector3,
      anchorB: THREE.Vector3,
    ) => {
      const rec: JointRec = {
        kind,
        a,
        b,
        mSup,
        capacity: BASE_CAPACITY[kind] * strength * (0.8 + 0.4 * rand()),
        layerFactor: 1 + 0.15 * layer,
        bodyA: a ? a.body : this.ground,
        anchorA: { x: anchorA.x, y: anchorA.y, z: anchorA.z },
        anchorB: { x: anchorB.x, y: anchorB.y, z: anchorB.z },
        handle: null,
      };
      this.createJoint(rec);
      building.joints.push(rec);
      if (a) a.joints.push(rec);
      b.joints.push(rec);
    };

    for (let ly = 0; ly < spec.ny; ly++) {
      for (let ix = 0; ix < spec.nx; ix++) {
        for (let iz = 0; iz < spec.nz; iz++) {
          const b = grid[ly][ix][iz];
          if (ly === 0) {
            // bottom blocks are anchored to the ground at their bottom centre
            addJoint(
              "ground",
              null,
              b,
              colMass(ly, ix, iz),
              0,
              new THREE.Vector3(b.home.x, b.home.y - half.y, b.home.z),
              new THREE.Vector3(0, -half.y, 0),
            );
          } else {
            const below = grid[ly - 1][ix][iz];
            addJoint(
              "vertical",
              below,
              b,
              colMass(ly, ix, iz),
              ly,
              new THREE.Vector3(0, half.y, 0),
              new THREE.Vector3(0, -half.y, 0),
            );
          }
          if (ix > 0) {
            const nb = grid[ly][ix - 1][iz];
            addJoint(
              "horizontal",
              nb,
              b,
              0.5 * Math.min(colMass(ly, ix - 1, iz), colMass(ly, ix, iz)),
              ly,
              new THREE.Vector3(half.x, 0, 0),
              new THREE.Vector3(-half.x, 0, 0),
            );
          }
          if (iz > 0) {
            const nb = grid[ly][ix][iz - 1];
            addJoint(
              "horizontal",
              nb,
              b,
              0.5 * Math.min(colMass(ly, ix, iz - 1), colMass(ly, ix, iz)),
              ly,
              new THREE.Vector3(0, 0, half.z),
              new THREE.Vector3(0, 0, -half.z),
            );
          }
        }
      }
    }

    // Antenna mast on node towers: one more block, fixed to the inner top
    // corner of block (0,0) of the top layer, i.e. the centre of the roof.
    if (spec.kind === "tower") {
      const mastHalf = new THREE.Vector3(0.15, MAST_HEIGHT / 2, 0.15);
      const mastCenter = new THREE.Vector3(spec.x, baseY + BODY_HEIGHT + MAST_HEIGHT / 2, spec.z);
      const geo = new THREE.CylinderGeometry(0.08, 0.12, MAST_HEIGHT, 8);
      const mat = new THREE.MeshStandardMaterial({ color: "#d7d3c8" });
      const mast = this.makeBlock(building, spec.ny, mastHalf, mastCenter, geo, mat, true);
      const lampMat = new THREE.MeshStandardMaterial({
        color: "#6cf08a",
        emissive: "#6cf08a",
        emissiveIntensity: 1.2,
      });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), lampMat);
      lamp.position.set(0, MAST_HEIGHT / 2, 0);
      mast.mesh.add(lamp);
      const dot = softDot();
      if (dot) {
        // additive halo around the lamp: cheap "bloom"
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: dot, color: "#6cf08a", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
        );
        halo.scale.set(3.2, 3.2, 1);
        halo.raycast = () => null;
        lamp.add(halo);
        this.halos.set(spec.nodeId ?? "", halo.material as THREE.SpriteMaterial);
      }
      if (spec.nodeId) this.lamps.set(spec.nodeId, lampMat);
      const topBlock = grid[spec.ny - 1][0][0];
      addJoint(
        "mast",
        topBlock,
        mast,
        mast.mass,
        spec.ny,
        new THREE.Vector3(half.x, half.y, half.z),
        new THREE.Vector3(0, -MAST_HEIGHT / 2, 0),
      );
    }

    // Visual foundation slab (not physical), hides the gap under the footing.
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w + 0.15, 1.2, spec.d + 0.15),
      new THREE.MeshStandardMaterial({ color: "#6b665e" }),
    );
    slab.receiveShadow = true;
    slab.position.set(spec.x, baseY - 0.6 + 0.02, spec.z);
    this.group.add(slab);
  }

  private makeBlock(
    building: Building,
    layer: number,
    half: THREE.Vector3,
    center: THREE.Vector3,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    isMast: boolean,
  ): Block {
    const R = this.R;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(center.x, center.y, center.z)
        .setLinearDamping(0.05)
        .setAngularDamping(0.1)
        .setCanSleep(true)
        .setSleeping(true),
    );
    const collider = this.world.createCollider(
      R.ColliderDesc.cuboid(
        half.x * COLLIDER_SHRINK,
        half.y * COLLIDER_SHRINK,
        half.z * COLLIDER_SHRINK,
      )
        .setDensity(1)
        .setFriction(0.8)
        .setRestitution(0.1)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const block: Block = {
      id: this.blocks.length,
      building,
      layer,
      isMast,
      half: half.clone(),
      mass: body.mass(),
      body,
      collider,
      mesh,
      home: center.clone(),
      joints: [],
      originalPositions: Float32Array.from(
        (geo.attributes.position as THREE.BufferAttribute).array as Float32Array,
      ),
      attached: true,
    };
    mesh.userData = { buildingId: building.spec.id, blockId: block.id };
    building.blocks.push(block);
    this.blocks.push(block);
    this.byCollider.set(collider.handle, block);
    this.group.add(mesh);
    if (!isMast) this.obstacles.push(mesh);
    return block;
  }

  private createJoint(rec: JointRec) {
    const data = this.R.JointData.fixed(rec.anchorA, IDENT, rec.anchorB, IDENT);
    rec.handle = this.world.createImpulseJoint(data, rec.bodyA, rec.b.body, false);
    // Jointed neighbours must not push on each other through contacts.
    rec.handle.setContactsEnabled(false);
  }

  private breakJoint(rec: JointRec) {
    if (!rec.handle) return;
    this.world.removeImpulseJoint(rec.handle, true);
    rec.handle = null;
    this.dirty.add(rec.b.building);
    this.brokenThisStep++;
  }

  // ---- public controls -----------------------------------------------------

  getBuilding(id: string): Building | undefined {
    return this.buildings.find((b) => b.spec.id === id);
  }

  /** Light or darken the antenna lamp of a node. */
  setNodeLit(nodeId: string, lit: boolean) {
    const m = this.lamps.get(nodeId);
    if (!m) return;
    const c = lit ? "#6cf08a" : "#c2453d";
    m.color.set(c);
    m.emissive.set(c);
    m.emissiveIntensity = lit ? 1.2 : 0.35;
    this.halos.get(nodeId)?.color.set(c);
  }

  /** Break every joint of a building and shove the blocks outwards. */
  demolish(building: Building) {
    for (const j of building.joints) this.breakJoint(j);
    for (const b of building.blocks) {
      const out = this.tmp.set(b.home.x - building.spec.x, 0, b.home.z - building.spec.z);
      if (out.lengthSq() < 1e-6) out.set(this.rand() - 0.5, 0, this.rand() - 0.5);
      out.normalize().multiplyScalar(b.mass * 2.5);
      b.body.applyImpulse({ x: out.x, y: b.mass * 1.5, z: out.z }, true);
    }
    this.updateIntegrity(building);
  }

  /** Put every block back where it started, undo dents, recreate all joints. */
  rebuild(building: Building) {
    for (const b of building.blocks) {
      b.body.setTranslation(b.home, true);
      b.body.setRotation(IDENT, true);
      b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const pos = b.mesh.geometry.attributes.position as THREE.BufferAttribute;
      (pos.array as Float32Array).set(b.originalPositions);
      pos.needsUpdate = true;
      b.mesh.geometry.computeVertexNormals();
      b.mesh.position.copy(b.home);
      b.mesh.quaternion.identity();
      b.attached = true;
    }
    for (const j of building.joints) {
      if (!j.handle) this.createJoint(j);
    }
    building.collapsed = false;
    building.detached = 0;
    for (const b of building.blocks) b.body.sleep();
  }

  resetAll() {
    for (const ball of this.balls) this.removeBall(ball);
    this.balls = [];
    for (const b of this.buildings) this.rebuild(b);
  }

  /**
   * Fire a ball. We aim at `target` and raise the aim point by the drop the
   * ball will suffer on the way (0.5 g t^2), so the shot lands where you clicked.
   */
  shoot(origin: THREE.Vector3, target: THREE.Vector3, speed: number, gravity: number) {
    const R = this.R;
    const dist = origin.distanceTo(target);
    const t = dist / speed;
    const aim = target.clone();
    aim.y += 0.5 * gravity * t * t;
    const dir = aim.sub(origin).normalize();
    const radius = 0.45;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(origin.x, origin.y, origin.z)
        .setLinvel(dir.x * speed, dir.y * speed, dir.z * speed)
        .setCcdEnabled(true),
    );
    const collider = this.world.createCollider(
      R.ColliderDesc.ball(radius)
        .setDensity(10)
        .setRestitution(0.2)
        .setFriction(0.6)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff7a00", emissiveIntensity: 0.6 }),
    );
    mesh.position.copy(origin);
    this.group.add(mesh);
    const ball: Ball = { body, collider, mesh, mass: body.mass(), age: 0 };
    this.balls.push(ball);
    this.byCollider.set(collider.handle, ball);
  }

  private removeBall(ball: Ball) {
    this.byCollider.delete(ball.collider.handle);
    this.prevVel.delete(ball);
    this.world.removeRigidBody(ball.body);
    this.group.remove(ball.mesh);
    ball.mesh.geometry.dispose();
    (ball.mesh.material as THREE.Material).dispose();
  }

  // ---- stepping ------------------------------------------------------------

  /** Advance the simulation by one fixed step of `h` simulated seconds. */
  step(h: number, env: DestructionEnv) {
    this.world.timestep = h;
    this.world.gravity = { x: 0, y: -env.gravity, z: 0 };
    this.brokenThisStep = 0;

    // 1. Remember velocities from before the step. After the solver has run a
    //    colliding body has already lost its speed, so the pre-collision speed
    //    must be saved now to compute the impact.
    for (const b of this.blocks) {
      if (b.body.isSleeping()) this.prevVel.delete(b);
      else this.prevVel.set(b, this.vel(b.body));
    }
    for (const ball of this.balls) this.prevVel.set(ball, this.vel(ball.body));

    // 2. Ground shaking. We simulate in the frame of the ground, so the
    //    ground's acceleration shows up as a fictitious force  -m * a  on
    //    every free body. (Same reason you lurch forward when a bus brakes.)
    const [ax, az] = env.quake;
    const shaking = ax !== 0 || az !== 0;
    if (shaking) {
      for (const b of this.blocks) {
        b.body.applyImpulse({ x: -b.mass * ax * h, y: 0, z: -b.mass * az * h }, true);
      }
    }

    // 3. Joint loads from shaking and gravity.
    const quakeMag = Math.hypot(ax, az);
    const weight = WEIGHT_FACTOR * env.gravity;
    for (const building of this.buildings) {
      for (const j of building.joints) {
        if (!j.handle) continue;
        const aEff = quakeMag * j.layerFactor;
        const load = Math.hypot(aEff, weight);
        if (load > j.capacity) this.breakJoint(j);
      }
    }

    // 4. Physics.
    this.world.step(this.queue);

    // 5. Collisions -> impact forces -> maybe more broken joints.
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (started) this.handleContact(h1, h2);
    });

    // 6. Connectivity: which blocks are still attached? Has a building fallen?
    Array.from(this.dirty).forEach((b) => this.updateIntegrity(b));
    this.dirty.clear();
    if (this.brokenThisStep > 0) this.callbacks.onJointsBroken?.(this.brokenThisStep);

    // 7. Retire old or fallen balls.
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      ball.age += h;
      if (ball.age > 25 || ball.body.translation().y < -30) {
        this.removeBall(ball);
        this.balls.splice(i, 1);
      }
    }
  }

  /** Copy rigid-body transforms to the meshes. Call once per rendered frame. */
  syncMeshes() {
    for (const b of this.blocks) {
      if (b.body.isSleeping()) continue;
      const t = b.body.translation();
      const r = b.body.rotation();
      b.mesh.position.set(t.x, t.y, t.z);
      b.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    for (const ball of this.balls) {
      const t = ball.body.translation();
      ball.mesh.position.set(t.x, t.y, t.z);
    }
  }

  private vel(body: RigidBody): THREE.Vector3 {
    const v = body.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }

  // ---- collisions ----------------------------------------------------------

  private handleContact(h1: number, h2: number) {
    const ground = this.groundCollider!.handle;
    // null stands for the ground
    const A = h1 === ground ? null : this.byCollider.get(h1);
    const B = h2 === ground ? null : this.byCollider.get(h2);
    if (A === undefined || B === undefined || (A === null && B === null)) return;

    const va = A ? this.prevVel.get(A) : undefined;
    const vb = B ? this.prevVel.get(B) : undefined;
    const rel = this.tmp.set(0, 0, 0);
    if (va) rel.add(va);
    if (vb) rel.sub(vb);
    const speed = rel.length();
    if (speed < MIN_IMPACT_SPEED) return;

    const ma = A ? A.mass : Infinity;
    const mb = B ? B.mass : Infinity;
    // Reduced mass: the effective mass of a two-body collision. With one body
    // immovable (the ground) it is just the other body's mass.
    const mRed = !isFinite(ma) ? mb : !isFinite(mb) ? ma : (ma * mb) / (ma + mb);
    const J = mRed * speed * (1 + RESTITUTION);

    for (const X of [A, B]) {
      if (X && !isBall(X)) this.impactOnBlock(X, J);
    }
    const ball = A && isBall(A) ? A : B && isBall(B) ? B : null;
    const other = ball === A ? B : A;
    if (ball && other && !isBall(other)) {
      this.dentBlock(other, ball, J);
      this.callbacks.onImpact?.(speed);
    }
  }

  /** Turn an impact impulse into forces on this block's joints and its neighbours'. */
  private impactOnBlock(block: Block, J: number) {
    const F = J / CONTACT_TIME;
    const own = block.joints.filter((j) => j.handle);
    for (const j of own) {
      if (F > j.capacity * j.mSup) this.breakJoint(j);
    }
    const F2 = F * NEIGHBOUR_FALLOFF;
    for (const j of own) {
      const other = j.a === block ? j.b : j.a;
      if (!other) continue;
      for (const k of other.joints) {
        if (k.handle && k !== j && F2 > k.capacity * k.mSup) this.breakJoint(k);
      }
    }
  }

  /** Visual dent in the struck block (see dent.ts). */
  private dentBlock(block: Block, ball: Ball, J: number) {
    const mesh = block.mesh;
    // Impact point: the point of the block closest to the ball's centre,
    // computed in the block's own frame (clamp to the box).
    const bt = block.body.translation();
    const br = block.body.rotation();
    this.tmpQ.set(br.x, br.y, br.z, br.w);
    const inv = this.tmpQ.clone().invert();
    const bp = ball.body.translation();
    const local = new THREE.Vector3(bp.x - bt.x, bp.y - bt.y, bp.z - bt.z).applyQuaternion(inv);
    const p = new THREE.Vector3(
      THREE.MathUtils.clamp(local.x, -block.half.x, block.half.x),
      THREE.MathUtils.clamp(local.y, -block.half.y, block.half.y),
      THREE.MathUtils.clamp(local.z, -block.half.z, block.half.z),
    );
    const v = this.prevVel.get(ball) ?? this.vel(ball.body);
    const dir = v.clone().normalize().applyQuaternion(inv);
    const minHalf = Math.min(block.half.x, block.half.y, block.half.z);
    const geo = mesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const moved = applyDent(
      pos.array as Float32Array,
      [p.x, p.y, p.z],
      [dir.x, dir.y, dir.z],
      0.85,
      dentDepth(J, minHalf),
    );
    if (moved > 0) {
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }
  }

  // ---- connectivity --------------------------------------------------------

  /**
   * Breadth-first search from the ground through the joints that still exist.
   * Blocks that cannot be reached are detached (falling or lying around). If
   * enough of a building is detached, or its antenna mast is, it has collapsed.
   */
  private updateIntegrity(b: Building) {
    const seen = new Set<Block>();
    const queue: Block[] = [];
    for (const j of b.joints) {
      if (j.kind === "ground" && j.handle && !seen.has(j.b)) {
        seen.add(j.b);
        queue.push(j.b);
      }
    }
    while (queue.length) {
      const cur = queue.pop()!;
      for (const j of cur.joints) {
        if (!j.handle) continue;
        const other = j.a === cur ? j.b : j.a;
        if (other && !seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    let detached = 0;
    let mastDown = false;
    for (const blk of b.blocks) {
      blk.attached = seen.has(blk);
      if (!blk.attached) {
        detached++;
        if (blk.isMast) mastDown = true;
      }
    }
    b.detached = detached;
    const frac = detached / b.blocks.length;
    if (!b.collapsed && (frac >= COLLAPSE_FRACTION || mastDown)) {
      b.collapsed = true;
      this.callbacks.onCollapse?.(b);
    }
  }

  dispose() {
    this.queue.free();
    for (const m of this.blocks) {
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.Material).dispose();
    }
  }
}
