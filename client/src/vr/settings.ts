/** Live simulation settings. Kept in a ref so changing them never re-renders the 3D scene. */
export interface SimSettings {
  /** m/s^2, what-if slider. */
  gravity: number;
  /** 1 = real time, 0.2 = slow motion. */
  timeScale: number;
  /** Quake strength multiplier. */
  quakeIntensity: number;
}

export const DEFAULT_SETTINGS: SimSettings = {
  gravity: 9.81,
  timeScale: 1,
  quakeIntensity: 1.2,
};

export const SLOWMO_SCALE = 0.2;
