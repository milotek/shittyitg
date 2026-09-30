import { Assets, Container, Text, TextStyle } from 'pixi.js'
import { Grade, type GradeValue } from '../../engine/play/judge.ts'

const FAMILY = 'Chakra Petch'

const LABEL: Record<GradeValue, string> = {
  [Grade.fantastic]: 'Fantastic',
  [Grade.excellent]: 'Excellent',
  [Grade.great]: 'Great',
  [Grade.decent]: 'Decent',
  [Grade.wayOff]: 'Way Off',
  [Grade.miss]: 'Miss',
}

const COLOUR: Record<GradeValue, string> = {
  [Grade.fantastic]: '#3fd8f2',
  [Grade.excellent]: '#f2b53f',
  [Grade.great]: '#6fd35c',
  [Grade.decent]: '#b77cff',
  [Grade.wayOff]: '#ee8a5a',
  [Grade.miss]: '#ff3b3b',
}

/** A combo is only worth showing once it is clearly a streak. */
const COMBO_FROM = 4

/** Seconds a judgment stays up before fading, and how long the fade takes. */
const JUDGMENT_HOLD = 0.6
const JUDGMENT_FADE = 0.15

/**
 * Judgment and combo. Sized and placed in cells like the field, so they sit in the same place
 * relative to the arrows at any resolution, but drawn as ordinary text in a pixel-space container
 * so glyphs are rasterised at their real size rather than scaled up from a tiny one.
 */
export class Hud {
  readonly container = new Container()
  readonly #judgment: Text
  readonly #combo: Text
  readonly #label: Text
  #cell = 1
  #judgedAt = Number.NEGATIVE_INFINITY
  #comboAt = Number.NEGATIVE_INFINITY
  #shownCombo = -1

  private constructor() {
    const style = (size: number, italic: boolean) =>
      new TextStyle({
        fontFamily: FAMILY,
        fontSize: size,
        fontWeight: italic ? '700' : '600',
        fontStyle: italic ? 'italic' : 'normal',
        fill: '#ffffff',
        stroke: { color: '#000000', width: size * 0.12, join: 'round' },
        letterSpacing: italic ? size * 0.02 : size * 0.3,
      })

    this.#judgment = new Text({ text: '', style: style(10, true), anchor: 0.5 })
    this.#combo = new Text({ text: '', style: style(10, true), anchor: 0.5 })
    this.#label = new Text({ text: 'COMBO', style: style(10, false), anchor: 0.5 })
    this.container.addChild(this.#judgment, this.#combo, this.#label)
  }

  static async load(): Promise<Hud> {
    await Assets.load([
      {
        src: 'fonts/chakrapetch_bolditalic.ttf',
        data: { family: FAMILY, weights: ['700'], style: 'italic' },
      },
      { src: 'fonts/chakrapetch_semibold.ttf', data: { family: FAMILY, weights: ['600'] } },
    ])
    return new Hud()
  }

  layout(cell: number, width: number, height: number): void {
    this.container.position.set(width / 2, height / 2)
    if (cell === this.#cell) return
    this.#cell = cell
    const size = (text: Text, cells: number) => {
      text.style.fontSize = cells * cell
      text.style.stroke = { color: '#000000', width: cells * cell * 0.12, join: 'round' }
      if (text !== this.#label) text.style.letterSpacing = cells * cell * 0.02
      else text.style.letterSpacing = cells * cell * 0.3
    }
    size(this.#judgment, 0.62)
    size(this.#combo, 0.72)
    size(this.#label, 0.24)
    this.#judgment.y = -0.25 * cell
    this.#combo.y = 0.55 * cell
    this.#label.y = 1.05 * cell
  }

  judge(grade: GradeValue, at: number): void {
    this.#judgment.text = LABEL[grade].toUpperCase()
    this.#judgment.style.fill = COLOUR[grade]
    this.#judgedAt = at
  }

  update(now: number, combo: number): void {
    if (combo !== this.#shownCombo) {
      if (combo > this.#shownCombo) this.#comboAt = now
      this.#shownCombo = combo
      this.#combo.text = String(combo)
    }

    const age = now - this.#judgedAt
    const pop = 1 + 0.25 * (1 - Math.min(age / 0.08, 1)) ** 2
    this.#judgment.scale.set(pop)
    this.#judgment.alpha =
      age < JUDGMENT_HOLD ? 1 : Math.max(1 - (age - JUDGMENT_HOLD) / JUDGMENT_FADE, 0)

    const visible = combo >= COMBO_FROM
    this.#combo.visible = visible
    this.#label.visible = visible
    this.#combo.scale.set(1 + 0.12 * (1 - Math.min((now - this.#comboAt) / 0.08, 1)))
  }
}
