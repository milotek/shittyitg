import { describe, expect, it } from 'vitest'
import { corners, flat, placement } from './quad.ts'

const run = (edit: (p: ReturnType<typeof placement>) => void, width = 1, height = 1, spin = 0) => {
  const p = placement()
  edit(p)
  const out = new Float32Array(8)
  corners(p, width, height, spin, flat, out, 0)
  return [...out]
}

describe('corners', () => {
  it('is an axis-aligned square of the given size at rest', () => {
    expect(run((p) => Object.assign(p, { x: 2, y: -1 }), 2, 1)).toEqual([
      1, -1.5, 3, -1.5, 3, -0.5, 1, -0.5,
    ])
  })

  it('turns a quarter about z', () => {
    const out = run((p) => {
      p.rotZ = Math.PI / 2
    })
    expect(out[0]).toBeCloseTo(0.5)
    expect(out[1]).toBeCloseTo(-0.5)
  })

  it('narrows under a turn about y, without a warp to foreshorten it', () => {
    const out = run((p) => {
      p.rotY = Math.PI / 3
    })
    expect(out[2] - out[0]).toBeCloseTo(0.5)
    expect(out[5] - out[1]).toBeCloseTo(1)
  })
})
