import { mountDevPanel } from './client/devpanel.ts'
import { Gameplay } from './client/gameplay/gameplay.ts'
import { SongSelect } from './client/select/select.ts'
import { loadSong } from './client/song.ts'
import { CPU, CPU_DEFAULT, PERFECT, type Skill } from './engine/play/auto.ts'
import { Background } from './render/background.ts'
import { Hud } from './render/hud/hud.ts'
import { NotefieldView } from './render/notefield/view.ts'
import { Stage } from './render/stage.ts'

const host = document.getElementById('app')
const title = document.getElementById('title')
const prompt = document.getElementById('prompt')
if (!host || !title || !prompt) throw new Error('index.html is missing #app, #title or #prompt')

const stage = await Stage.create(host)
const [field, hud] = await Promise.all([NotefieldView.load(), Hud.load()])
const background = new Background()
const select = new SongSelect()

// Browsers only let audio start from a user gesture, so the title screen asks for one.
prompt.textContent = 'press any key'
await new Promise<void>((resolve) => {
  const go = (event: Event) => {
    event.preventDefault()
    removeEventListener('keydown', go)
    removeEventListener('pointerdown', go)
    resolve()
  }
  addEventListener('keydown', go)
  addEventListener('pointerdown', go)
})
title.hidden = true

const query = new URLSearchParams(location.search)

/**
 * `?auto` watches the chart played perfectly, and `?cpu` sets a player against it instead,
 * optionally at a strength from 0 to 7. Either way nothing reads the keyboard, so both outlast
 * the song they were asked for rather than applying only to the first one.
 */
const skill = ((): Skill | undefined => {
  if (query.has('cpu')) {
    const level = Number(query.get('cpu') || CPU_DEFAULT)
    return CPU[Math.min(Math.max(Math.round(level), 0), CPU.length - 1)]
  }
  return query.has('auto') ? PERFECT : undefined
})()

const play = async (slug: string, chart: number, fromBeat: number) => {
  const gameplay = new Gameplay(stage, { field, hud, background }, await loadSong(slug), chart)
  let unmount: (() => void) | undefined
  if (import.meta.env.DEV) {
    unmount = mountDevPanel(gameplay.mods)
    ;(window as unknown as { gameplay: Gameplay }).gameplay = gameplay
  }
  await gameplay.play(fromBeat, skill)
  unmount?.()
}

const direct = query.get('song')
if (direct) await play(direct, 0, Number(query.get('at') ?? 0))

for (;;) {
  const choice = await select.choose()
  await play(choice.slug, choice.chart, 0)
}
