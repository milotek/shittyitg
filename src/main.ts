import { createStage, paintProbe } from './render/stage.ts'

const host = document.getElementById('app')
if (!host) throw new Error('index.html is missing #app')

const app = await createStage(host)
paintProbe(app)
