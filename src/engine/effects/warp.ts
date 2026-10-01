import type { Warp } from '../draw/quad.ts'
import type { ModState } from '../mods/track.ts'
import { CAMERA_DISTANCE, FIELD_HEIGHT } from './field.ts'

const DEGREE = Math.PI / 180

/** One unit of tilt leans the field this far back. */
const TILT_ANGLE = 30 * DEGREE

/** One unit of skew slides the vanishing point this many cells sideways. */
const SKEW_CELLS = FIELD_HEIGHT * 0.4

/** Never let a corner reach the camera, where the divide would throw it to infinity. */
const NEAREST = CAMERA_DISTANCE * 0.1

/**
 * The whole field's transform, standing in for a projection matrix. Each corner is turned about
 * the field's centre, then divided by its own depth, so an arrow leaning away gets a smaller far
 * edge. That per-corner divide is the only perspective in the engine, and it is why a four-corner
 * quad can tumble and foreshorten without a `w` component.
 *
 * The named perspective mods are corners of one (tilt, skew) square: `distant` sends the far end
 * away and `hallway` brings it toward you, `space` and `incoming` are those same two with the
 * vanishing point slid sideways, and `overhead` pulls everything back to flat.
 */
export function fieldWarp(mods: ModState): Warp {
  const flatten = 1 - mods.get('overhead')
  const tilt =
    (mods.get('tilt') +
      mods.get('distant') -
      mods.get('hallway') -
      mods.get('incoming') +
      mods.get('space')) *
    flatten
  const skew = (mods.get('skew') + mods.get('incoming') + mods.get('space')) * flatten

  const angleX = -tilt * TILT_ANGLE + mods.get('rotationx') * DEGREE
  const angleY = mods.get('rotationy') * DEGREE
  const angleZ = mods.get('rotationz') * DEGREE
  const vanishX = -skew * SKEW_CELLS

  const sinX = Math.sin(angleX)
  const cosX = Math.cos(angleX)
  const sinY = Math.sin(angleY)
  const cosY = Math.cos(angleY)
  const sinZ = Math.sin(angleZ)
  const cosZ = Math.cos(angleZ)

  return (x, y, z, out, at) => {
    const zx = x * cosZ - y * sinZ
    let py = x * sinZ + y * cosZ
    let px = zx

    const xy = py * cosX - z * sinX
    let pz = py * sinX + z * cosX
    py = xy

    const yx = px * cosY + pz * sinY
    pz = -px * sinY + pz * cosY
    px = yx

    const scale = CAMERA_DISTANCE / Math.max(CAMERA_DISTANCE - pz, NEAREST)
    out[at] = vanishX + (px - vanishX) * scale
    out[at + 1] = py * scale
  }
}
