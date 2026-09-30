import { mountDevPanel } from './client/devpanel.ts'
import { Gameplay } from './client/gameplay/gameplay.ts'
import { loadSong } from './client/song.ts'
import { NotefieldView } from './render/notefield/view.ts'
import { createStage } from './render/stage.ts'

const host = document.getElementById('app')
const prompt = document.getElementById('prompt')
if (!host || !prompt) throw new Error('index.html is missing #app or #prompt')

const app = await createStage(host)
const field = await NotefieldView.load()
const query = new URLSearchParams(location.search)
const song = await loadSong(query.get('song') ?? 'clicktrack')

prompt.textContent = 'press any key'
const begin = async () => {
  removeEventListener('keydown', begin)
  removeEventListener('pointerdown', begin)
  prompt.hidden = true
  const gameplay = new Gameplay(app, field, song)
  if (import.meta.env.DEV) {
    mountDevPanel(gameplay.mods)
    ;(window as unknown as { gameplay: Gameplay }).gameplay = gameplay
  }
  await gameplay.start(Number(query.get('at') ?? 0))
}
addEventListener('keydown', begin)
addEventListener('pointerdown', begin)
