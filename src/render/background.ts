import { Assets, Container, Sprite, type Texture } from 'pixi.js'

/** Dim enough that every quant colour still reads against the brightest artwork. */
const BRIGHTNESS = 0.3

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
      tint: Math.round(BRIGHTNESS * 0xff) * 0x010101,
    })
    this.container.addChild(this.#sprite)
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
