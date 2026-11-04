import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GyroTracker } from "@/vr/gyro";
import { terrainHeight } from "@/vr/data";

export const EYE_HEIGHT = 2.2;

/**
 * Phone Cardboard mode: two views side by side, one per eye, and head
 * tracking from the phone's gyroscope. A tap selects whatever is under the
 * centre reticle (gaze pointing).
 *
 * Mounting this component takes over rendering (useFrame with priority > 0
 * switches off R3F's automatic render), so it is only mounted in this mode.
 *
 * Not done: the barrel-distortion pass that cancels the Cardboard lenses'
 * pincushion distortion. Without it the picture is flat but slightly warped
 * at the edges.
 */
export function CardboardRig({ viewpoint }: { viewpoint: [number, number] }) {
  const { gl, scene, camera, size, get, setEvents } = useThree();

  const stereo = useMemo(() => {
    const s = new THREE.StereoCamera();
    s.aspect = 0.5; // each eye gets half of the screen width
    s.eyeSep = 0.064; // interpupillary distance in metres (scene units are metres)
    return s;
  }, []);
  const gyro = useMemo(() => new GyroTracker(), []);

  // Gyroscope on while mounted.
  useEffect(() => {
    gyro.start();
    return () => gyro.stop();
  }, [gyro]);

  // Camera setup, restored on exit.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const saved = { fov: cam.fov, pos: cam.position.clone(), quat: cam.quaternion.clone() };
    cam.fov = 75;
    cam.updateProjectionMatrix();
    return () => {
      cam.fov = saved.fov;
      cam.updateProjectionMatrix();
      cam.position.set(0, 38, 62);
      cam.lookAt(0, 0, 0);
    };
  }, [camera]);

  // Gaze pointing: pointer events always cast from the centre of the screen.
  useEffect(() => {
    const prev = get().events.compute;
    setEvents({
      compute: (_event, state) => {
        state.pointer.set(0, 0);
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
    });
    return () => setEvents({ compute: prev });
  }, [get, setEvents]);

  // Reticle: a small ring parented to the camera, so it stays at screen centre.
  useEffect(() => {
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.04, 24),
      new THREE.MeshBasicMaterial({ color: "#C8A97E", depthTest: false, transparent: true }),
    );
    reticle.position.set(0, 0, -2);
    reticle.renderOrder = 999;
    camera.add(reticle);
    scene.add(camera);
    return () => {
      camera.remove(reticle);
      scene.remove(camera);
      reticle.geometry.dispose();
      (reticle.material as THREE.Material).dispose();
    };
  }, [camera, scene]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(viewpoint[0], terrainHeight(viewpoint[0], viewpoint[1]) + EYE_HEIGHT, viewpoint[1]);
    // Without sensor data (desktop test) keep looking along -Z.
    if (gyro.hasData) cam.quaternion.copy(gyro.quaternion);
    else cam.quaternion.identity();
    cam.updateMatrixWorld();
    stereo.update(cam);

    const w = size.width;
    const h = size.height;
    gl.setScissorTest(true);
    gl.setViewport(0, 0, w / 2, h);
    gl.setScissor(0, 0, w / 2, h);
    gl.render(scene, stereo.cameraL);
    gl.setViewport(w / 2, 0, w / 2, h);
    gl.setScissor(w / 2, 0, w / 2, h);
    gl.render(scene, stereo.cameraR);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, w, h);
  }, 1);

  return null;
}
