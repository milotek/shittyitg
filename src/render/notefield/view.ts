import { Assets, Container, type Texture } from 'pixi.js'
import { DrawList } from '../../engine/draw/drawlist.ts'
import { FIELD_HEIGHT } from '../../engine/effects/field.ts'
import { drawField, type FieldFrame } from './field.ts'
import { QuadMesh } from './mesh.ts'
import { Skin, type SkinManifest } from './skin.ts'

const CAPACITY = 8192

/** 16:9 is the target; anything narrower keeps the whole 16:9 frame visible rather than cropping it. */
const ASPECT = 16 / 9

export class NotefieldView {
  readonly container = new Container()
  readonly skin: Skin
  readonly #list = new DrawList(CAPACITY)
  readonly #mesh: QuadMesh

  private constructor(skin: Skin, texture: Texture) {
    this.skin = skin
    this.#mesh = new QuadMesh(texture, CAPACITY)
    this.container.addChild(this.#mesh.view)
  }

  static async load(): Promise<NotefieldView> {
    const manifest = (await (await fetch('noteskin/noteskin.json')).json()) as SkinManifest
    const texture = await Assets.load<Texture>({
      src: `noteskin/${manifest.texture}`,
      data: { autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear' },
    })
    return new NotefieldView(new Skin(manifest), texture)
  }

  /** The only place a cell becomes a pixel. */
  layout(width: number, height: number): number {
    const cell = Math.min(height, width / ASPECT) / FIELD_HEIGHT
    this.container.scale.set(cell)
    this.container.position.set(width / 2, height / 2)
    return cell
  }

  render(frame: Omit<FieldFrame, 'skin'>): void {
    this.#list.clear()
    drawField(this.#list, { ...frame, skin: this.skin })
    this.#mesh.upload(this.#list)
  }
}
