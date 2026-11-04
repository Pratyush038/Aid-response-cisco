// Head tracking for the phone Cardboard fallback.
//
// A phone reports its orientation as three Euler angles (alpha, beta, gamma)
// from the gyroscope and magnetometer, through the `deviceorientation` event.
// We turn them into a camera quaternion. The maths is the standard one: the
// phone's axes differ from the camera's (the camera looks down -Z, the phone
// screen faces +Z), so we compose the device rotation with a fixed -90 degree
// turn about X, and finally with the rotation of the screen (portrait or
// landscape).
//
// The first reading defines "straight ahead": we remember its heading (yaw)
// and subtract it, so the user starts out looking north over the map no matter
// which way they happen to be standing.

import * as THREE from "three";

const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 deg about X
const zAxis = new THREE.Vector3(0, 0, 1);
const yAxis = new THREE.Vector3(0, 1, 0);

export class GyroTracker {
  /** Current head orientation; identity until the first sensor reading. */
  readonly quaternion = new THREE.Quaternion();
  /** True once at least one real sensor reading arrived. */
  hasData = false;
  private yaw0: number | null = null;
  private yawFix = new THREE.Quaternion();

  private onEvent = (e: DeviceOrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    const D = THREE.MathUtils.degToRad;
    const orient = D(typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0);
    euler.set(D(e.beta), D(e.alpha), -D(e.gamma), "YXZ");
    this.quaternion.setFromEuler(euler);
    this.quaternion.multiply(q1);
    this.quaternion.multiply(q0.setFromAxisAngle(zAxis, -orient));

    if (this.yaw0 === null) {
      this.yaw0 = euler.setFromQuaternion(this.quaternion, "YXZ").y;
      this.yawFix.setFromAxisAngle(yAxis, -this.yaw0);
    }
    this.quaternion.premultiply(this.yawFix);
    this.hasData = true;
  };

  start() {
    window.addEventListener("deviceorientation", this.onEvent);
  }

  stop() {
    window.removeEventListener("deviceorientation", this.onEvent);
  }

  /** Make the current heading the new "straight ahead". */
  recenter() {
    this.yaw0 = null;
  }
}

/**
 * iOS requires an explicit permission prompt, and only from a user gesture.
 * Other browsers just work. Returns whether sensor data may be used.
 */
export async function requestGyroPermission(): Promise<boolean> {
  const DOE = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> })
    | undefined;
  if (!DOE) return false;
  if (typeof DOE.requestPermission === "function") {
    try {
      return (await DOE.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}
