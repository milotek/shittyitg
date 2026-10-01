import { MODS } from '../engine/mods/registry.ts'
import type { ModState } from '../engine/mods/track.ts'

/** Engine units a slider covers, chosen so the full throw of each shows its whole character. */
const RANGE: Record<string, [number, number]> = {
  xmod: [0.25, 6],
  cmod: [0, 900],
  confusionoffset: [-360, 360],
  rotationx: [-90, 90],
  rotationy: [-90, 90],
  rotationz: [-180, 180],
}

/** Dev builds only: pin any one mod with a slider, so each can be judged on its own in motion. */
export function mountDevPanel(mods: ModState): () => void {
  const panel = document.createElement('form')
  panel.id = 'devpanel'
  panel.innerHTML = `
    <select name="mod">${Object.keys(MODS)
      .map((m) => `<option>${m}</option>`)
      .join('')}</select>
    <input name="level" type="range" step="any" />
    <output name="value"></output>
    <button name="reset" type="button">clear</button>
  `
  document.body.append(panel)

  const select = panel.elements.namedItem('mod') as HTMLSelectElement
  const slider = panel.elements.namedItem('level') as HTMLInputElement
  const output = panel.elements.namedItem('value') as HTMLOutputElement
  const reset = panel.elements.namedItem('reset') as HTMLButtonElement
  let pinned: string | undefined

  const configure = () => {
    if (pinned) mods.override(pinned, undefined)
    const [low, high] = RANGE[select.value] ?? [-2, 2]
    slider.min = String(low)
    slider.max = String(high)
    slider.value = String(mods.get(select.value))
    apply()
  }
  const apply = () => {
    pinned = select.value
    mods.override(pinned, Number(slider.value))
    output.value = Number(slider.value).toFixed(2)
  }

  select.addEventListener('change', configure)
  slider.addEventListener('input', apply)
  reset.addEventListener('click', () => {
    if (pinned) mods.override(pinned, undefined)
    pinned = undefined
    output.value = ''
  })
  panel.addEventListener('keydown', (event) => event.stopPropagation())
  ;(window as unknown as { mods: ModState }).mods = mods
  return () => panel.remove()
}
