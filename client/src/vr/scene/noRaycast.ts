/**
 * Pass as `raycast` to decorative objects so pointer rays ignore them.
 *
 * Needed in a headset session: the XR pointer code raycasts every object under
 * a clickable group, and fat lines (Line2) and sprites throw when the raycaster
 * has no camera. They are not meant to be clicked anyway.
 */
export const noRaycast = () => null;
