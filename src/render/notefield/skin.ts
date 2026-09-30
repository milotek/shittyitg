import type { UvRect } from '../../engine/draw/drawlist.ts'

type Rect = [number, number, number, number]

export type SkinManifest = {
  texture: string
  cellPixels: number
  size: [number, number]
  tap: { animationBeats: number; frames: Record<string, Rect[]> }
  mine: { animationBeats: number; frames: Rect[] }
  sprites: Record<string, { rect: Rect; cells: [number, number] }>
}

export type Sprite = { uv: UvRect; width: number; height: number }

/** The skin ships six colours, so every other quant borrows the nearest one a player expects. */
const QUANT_COLOUR: Record<number, string> = {
  4: '4',
  8: '8',
  12: '12',
  16: '16',
  24: '12',
  32: '32',
  48: '64',
  64: '64',
  192: '64',
}

export class Skin {
  readonly #taps: Map<string, UvRect[]>
  readonly #mines: UvRect[]
  readonly #tapBeats: number
  readonly #mineBeats: number
  readonly #sprites: Map<string, Sprite>

  constructor(manifest: SkinManifest) {
    const [width, height] = manifest.size
    const uv = ([x, y, w, h]: Rect): UvRect => ({
      u0: x / width,
      v0: y / height,
      u1: (x + w) / width,
      v1: (y + h) / height,
    })

    this.#taps = new Map(
      Object.entries(manifest.tap.frames).map(([q, rects]) => [q, rects.map(uv)]),
    )
    this.#mines = manifest.mine.frames.map(uv)
    this.#tapBeats = manifest.tap.animationBeats
    this.#mineBeats = manifest.mine.animationBeats
    this.#sprites = new Map(
      Object.entries(manifest.sprites).map(([name, sprite]) => [
        name,
        { uv: uv(sprite.rect), width: sprite.cells[0], height: sprite.cells[1] },
      ]),
    )
  }

  tap(quant: number, beat: number): UvRect {
    const frames = this.#taps.get(QUANT_COLOUR[quant] ?? '64') as UvRect[]
    return frames[frameAt(beat, this.#tapBeats, frames.length)] as UvRect
  }

  mine(beat: number): UvRect {
    return this.#mines[frameAt(beat, this.#mineBeats, this.#mines.length)] as UvRect
  }

  sprite(name: string): Sprite {
    const sprite = this.#sprites.get(name)
    if (!sprite) throw new Error(`the noteskin has no sprite "${name}"`)
    return sprite
  }
}

function frameAt(beat: number, length: number, frames: number): number {
  const phase = (((beat / length) % 1) + 1) % 1
  return Math.min(Math.floor(phase * frames), frames - 1)
}
