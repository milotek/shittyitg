import { Application } from 'pixi.js'

export async function createStage(host: HTMLElement): Promise<Application> {
  const app = new Application()
  await app.init({
    preference: 'webgl',
    resizeTo: host,
    background: '#000000',
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  })
  host.appendChild(app.canvas)
  return app
}
