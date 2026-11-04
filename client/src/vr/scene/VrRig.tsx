import { useRef } from "react";
import * as THREE from "three";
import { TeleportTarget, XROrigin, useXR, useXRControllerLocomotion } from "@react-three/xr";
import { terrainHeight } from "@/vr/data";
import { WorldHud, type HudModel } from "./WorldHud";

/**
 * The player's rig in a headset session.
 *
 *  - XROrigin is the player's feet. The headset and the controllers are
 *    positioned relative to it, so moving the origin moves the player.
 *  - Smooth locomotion: left stick walks, right stick turns in 30 degree steps.
 *  - Teleport: push a stick forward to get a parabolic pointer and release it
 *    on the ground (the terrain is wrapped in <TeleportTarget> in the page).
 *  - The HUD is a child of the origin, so it follows the player when they move
 *    but is not glued to the head (head-locked UI is uncomfortable in VR).
 */
export function VrRig({
  viewpoint,
  hud,
  showHud,
}: {
  viewpoint: [number, number];
  hud: HudModel;
  showHud: boolean;
}) {
  const origin = useRef<THREE.Group>(null);
  useXRControllerLocomotion(origin, { speed: 4 }, { type: "snap", degrees: 30 });
  const inXR = useXR((s) => s.session != null);

  return (
    <XROrigin
      ref={origin}
      position={[viewpoint[0], terrainHeight(viewpoint[0], viewpoint[1]), viewpoint[1]]}
    >
      {(inXR || showHud) && <WorldHud hud={hud} />}
    </XROrigin>
  );
}

export { TeleportTarget };
