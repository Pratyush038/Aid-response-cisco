import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BODY_HEIGHT, MAST_HEIGHT, VR_NODES, baseHeight } from "@/vr/data";
import { canvasTexture, drawTextCanvas } from "@/vr/canvasText";

const GOLD = "#C8A97E";

/** A billboard (sprite) with the node name, drawn into a canvas texture. */
function NodeLabel({
  name,
  x,
  z,
  dead,
  isSource,
}: {
  name: string;
  x: number;
  z: number;
  dead: boolean;
  isSource: boolean;
}) {
  const { texture, aspect } = useMemo(() => {
    const canvas = drawTextCanvas([name], {
      fontPx: 30,
      padding: 12,
      color: dead ? "#e58b84" : "#e8e4da",
      background: "rgba(17,17,16,0.78)",
      border: isSource ? GOLD : "rgba(255,255,255,0.18)",
      align: "center",
    });
    return { texture: canvasTexture(canvas), aspect: canvas.width / canvas.height };
  }, [name, dead, isSource]);
  useEffect(() => () => texture.dispose(), [texture]);

  const height = 1.5;
  const y = baseHeight(x, z, 2.2, 2.2) + BODY_HEIGHT + MAST_HEIGHT + 2.2;
  return (
    <sprite position={[x, y, z]} scale={[height * aspect, height, 1]}>
      {/* depthTest off keeps labels readable through buildings */}
      <spriteMaterial map={texture} transparent depthTest={false} sizeAttenuation />
    </sprite>
  );
}

export function NodeLabels({
  dead,
  source,
}: {
  dead: ReadonlySet<string>;
  source: string;
}) {
  return (
    <>
      {VR_NODES.map((n) => (
        <NodeLabel
          key={n.nodeId}
          name={n.name}
          x={n.x}
          z={n.z}
          dead={dead.has(n.nodeId)}
          isSource={n.nodeId === source}
        />
      ))}
    </>
  );
}

/** Gold ring on the ground under the current SOS source. */
export function SourceRing({ source }: { source: string }) {
  const n = VR_NODES.find((v) => v.nodeId === source);
  if (!n) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[n.x, baseHeight(n.x, n.z, 2.2, 2.2) + 0.12, n.z]}
    >
      <ringGeometry args={[2.4, 2.9, 48]} />
      <meshBasicMaterial color={GOLD} side={THREE.DoubleSide} />
    </mesh>
  );
}
