import { Gameplay } from './client/gameplay/gameplay.ts'
import { loadSong } from './client/song.ts'
import { NotefieldView } from './render/notefield/view.ts'
import { createStage } from './render/stage.ts'

const host = document.getElementById('app')
const prompt = document.getElementById('prompt')
if (!host || !prompt) throw new Error('index.html is missing #app or #prompt')

const app = await createStage(host)
const field = await NotefieldView.load()
const song = await loadSong(new URLSearchParams(location.search).get('song') ?? 'clicktrack')

prompt.textContent = 'press any key'
const begin = async () => {
  removeEventListener('keydown', begin)
  removeEventListener('pointerdown', begin)
  prompt.hidden = true
  await new Gameplay(app, field, song).start()
}
addEventListener('keydown', begin)
addEventListener('pointerdown', begin)
