import { Assets, Container, Sprite, type Texture } from 'pixi.js'

/** Dim enough that every quant colour still reads against the brightest artwork. */
const BRIGHTNESS = 0.3

const tintFor = (level: number) => Math.round(clamp(level, 0, 1) * 0xff) * 0x010101

export class Background {
  readonly container = new Container()
  #sprite: Sprite | undefined

  async show(url: string | undefined): Promise<void> {
    this.hide()
    if (!url) return
    const texture = await Assets.load<Texture>(url)
    this.#sprite = new Sprite({
      texture,
      anchor: 0.5,
      tint: tintFor(BRIGHTNESS),
    })
    this.container.addChild(this.#sprite)
  }

  /**
   * `cover` dims the artwork toward black so the notefield reads against it. A negative value
   * brightens instead, which is how a chart asks for the artwork at full strength rather than the
   * dimmed default, and is what ftw's original does for its whole length.
   */
  dim(cover: number): void {
    if (this.#sprite) this.#sprite.tint = tintFor(BRIGHTNESS * (1 - cover))
  }

  hide(): void {
    this.#sprite?.destroy()
    this.#sprite = undefined
  }

  /** Covers the screen, cropping rather than letterboxing. */
  layout(width: number, height: number): void {
    const sprite = this.#sprite
    if (!sprite) return
    const scale = Math.max(width / sprite.texture.width, height / sprite.texture.height)
    sprite.scale.set(scale)
    sprite.position.set(width / 2, height / 2)
  }
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}
