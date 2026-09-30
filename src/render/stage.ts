import { Application, Graphics } from 'pixi.js'

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

export function paintProbe(app: Application): void {
  const quad = new Graphics()
  app.stage.addChild(quad)
  app.ticker.add(() => {
    const size = app.screen.height / 7.5
    quad
      .clear()
      .rect(app.screen.width / 2 - size / 2, app.screen.height / 2 - size / 2, size, size)
      .fill('#ffffff')
  })
}
