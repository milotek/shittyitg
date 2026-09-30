import { mountDevPanel } from './client/devpanel.ts'
import { Gameplay } from './client/gameplay/gameplay.ts'
import { loadSong } from './client/song.ts'
import { Hud } from './render/hud/hud.ts'
import { NotefieldView } from './render/notefield/view.ts'
import { createStage } from './render/stage.ts'

const host = document.getElementById('app')
const prompt = document.getElementById('prompt')
if (!host || !prompt) throw new Error('index.html is missing #app or #prompt')

const app = await createStage(host)
const [field, hud] = await Promise.all([NotefieldView.load(), Hud.load()])
const query = new URLSearchParams(location.search)
const song = await loadSong(query.get('song') ?? 'clicktrack')

prompt.textContent = 'press any key'
const begin = async () => {
  removeEventListener('keydown', begin)
  removeEventListener('pointerdown', begin)
  prompt.hidden = true
  const gameplay = new Gameplay(app, field, hud, song)
  if (import.meta.env.DEV) {
    mountDevPanel(gameplay.mods)
    ;(window as unknown as { gameplay: Gameplay }).gameplay = gameplay
  }
  await gameplay.play(Number(query.get('at') ?? 0))
}
addEventListener('keydown', begin)
addEventListener('pointerdown', begin)
