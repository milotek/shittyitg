export type UvRect = { u0: number; v0: number; u1: number; v1: number }

/** Paint order, lowest first. Within a layer, a larger `depth` argument draws earlier. */
export const Layer = {
  receptor: 0,
  holdBody: 1,
  holdCap: 2,
  note: 3,
  flash: 4,
} as const

/**
 * One frame's quads in cell space. Everything is written into preallocated typed arrays so a
 * frame allocates nothing, and the renderer reads them back in `order()`.
 */
export class DrawList {
  readonly capacity: number
  readonly positions: Float32Array
  readonly uvs: Float32Array
  readonly colors: Uint32Array
  readonly glows: Float32Array
  readonly #keys: Float64Array
  readonly #order: number[] = []
  count = 0

  constructor(capacity: number) {
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 8)
    this.uvs = new Float32Array(capacity * 8)
    this.colors = new Uint32Array(capacity)
    this.glows = new Float32Array(capacity)
    this.#keys = new Float64Array(capacity)
  }

  clear(): void {
    this.count = 0
  }

  /** Reserves a quad and returns its index. Its corners go into `positions` at `index * 8`. */
  add(layer: number, depth: number): number {
    if (this.count === this.capacity) throw new Error(`draw list is full at ${this.capacity} quads`)
    const index = this.count++
    this.#keys[index] = layer * 1e4 - depth
    return index
  }

  /** Corners in the order top-left, top-right, bottom-right, bottom-left. */
  paint(
    index: number,
    uv: UvRect,
    red: number,
    green: number,
    blue: number,
    alpha: number,
    glow: number,
  ): void {
    const at = index * 8
    const uvs = this.uvs
    uvs[at] = uv.u0
    uvs[at + 1] = uv.v0
    uvs[at + 2] = uv.u1
    uvs[at + 3] = uv.v0
    uvs[at + 4] = uv.u1
    uvs[at + 5] = uv.v1
    uvs[at + 6] = uv.u0
    uvs[at + 7] = uv.v1

    const a = clamp01(alpha)
    this.colors[index] =
      ((Math.round(a * 255) << 24) |
        (Math.round(clamp01(blue) * a * 255) << 16) |
        (Math.round(clamp01(green) * a * 255) << 8) |
        Math.round(clamp01(red) * a * 255)) >>>
      0
    this.glows[index] = clamp01(glow) * a
  }

  /**
   * Adds light instead of covering what is beneath. The blend is premultiplied, so colour with
   * zero alpha is additive, which keeps glows inside the same single pipeline state.
   */
  paintAdditive(
    index: number,
    uv: UvRect,
    red: number,
    green: number,
    blue: number,
    intensity: number,
  ): void {
    this.paint(index, uv, red * intensity, green * intensity, blue * intensity, 1, 0)
    this.colors[index] = ((this.colors[index] as number) & 0x00ffffff) >>> 0
  }

  order(): readonly number[] {
    const order = this.#order
    order.length = this.count
    for (let i = 0; i < this.count; i++) order[i] = i
    const keys = this.#keys
    order.sort((a, b) => (keys[a] as number) - (keys[b] as number) || a - b)
    return order
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
