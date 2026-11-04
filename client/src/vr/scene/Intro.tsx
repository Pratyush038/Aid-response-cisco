import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const FROM = new THREE.Vector3(0, 120, 20);
const TO = new THREE.Vector3(0, 38, 62);
const DURATION = 3.6;

/**
 * Desktop opening shot: the camera descends from high above to the normal
 * viewpoint. Any mouse press stops it at once, so it never fights the user.
 */
export function Intro() {
  const { camera, gl } = useThree();
  const t = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const stop = () => {
      done.current = true;
    };
    gl.domElement.addEventListener("pointerdown", stop);
    gl.domElement.addEventListener("wheel", stop);
    return () => {
      gl.domElement.removeEventListener("pointerdown", stop);
      gl.domElement.removeEventListener("wheel", stop);
    };
  }, [gl]);

  useFrame((_, delta) => {
    if (done.current) return;
    t.current += Math.min(delta, 0.1);
    const k = Math.min(1, t.current / DURATION);
    const e = 1 - Math.pow(1 - k, 3); // ease-out
    camera.position.lerpVectors(FROM, TO, e);
    camera.lookAt(0, 0, 0);
    if (k >= 1) done.current = true;
  });
  return null;
}
