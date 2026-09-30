export type Placement = {
  x: number
  y: number
  depth: number
  scaleX: number
  scaleY: number
  /** Radians. */
  rotX: number
  rotY: number
  rotZ: number
  alpha: number
  glow: number
}

export function placement(): Placement {
  return {
    x: 0,
    y: 0,
    depth: 0,
    scaleX: 1,
    scaleY: 1,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    alpha: 1,
    glow: 0,
  }
}

/** Maps a cell-space point with fake depth onto the flat field. The identity at rest. */
export type Warp = (x: number, y: number, z: number, out: Float32Array, at: number) => void

export const flat: Warp = (x, y, _z, out, at) => {
  out[at] = x
  out[at + 1] = y
}

const CORNERS = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5] as const

/**
 * Four corners, in the order top-left, top-right, bottom-right, bottom-left, written as eight
 * floats. Rotation is three hand-composed turns rather than a matrix, and the warp stands in for
 * a projection, so there is no matrix stack and no `w`.
 */
export function corners(
  p: Placement,
  width: number,
  height: number,
  spin: number,
  warp: Warp,
  out: Float32Array,
  at: number,
): void {
  const sinZ = Math.sin(p.rotZ + spin)
  const cosZ = Math.cos(p.rotZ + spin)
  const sinY = Math.sin(p.rotY)
  const cosY = Math.cos(p.rotY)
  const sinX = Math.sin(p.rotX)
  const cosX = Math.cos(p.rotX)

  for (let i = 0; i < 4; i++) {
    let px = (CORNERS[i * 2] as number) * width * p.scaleX
    let py = (CORNERS[i * 2 + 1] as number) * height * p.scaleY
    let pz = 0

    const zx = px * cosZ - py * sinZ
    py = px * sinZ + py * cosZ
    px = zx

    const yx = px * cosY + pz * sinY
    pz = -px * sinY + pz * cosY
    px = yx

    const xy = py * cosX - pz * sinX
    pz = py * sinX + pz * cosX
    py = xy

    warp(p.x + px, p.y + py, p.depth + pz, out, at + i * 2)
  }
}
