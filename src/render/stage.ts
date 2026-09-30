import { Application, type Container } from 'pixi.js'

type View = { readonly container: Container }

/** The canvas and its frame loop, so nothing outside the renderer has to know Pixi exists. */
export class Stage {
  readonly #app: Application

  private constructor(app: Application) {
    this.#app = app
  }

  static async create(host: HTMLElement): Promise<Stage> {
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
    return new Stage(app)
  }

  get width(): number {
    return this.#app.screen.width
  }

  get height(): number {
    return this.#app.screen.height
  }

  /** Runs `frame` before every render until the returned function is called. */
  every(frame: () => void): () => void {
    this.#app.ticker.add(frame)
    return () => this.#app.ticker.remove(frame)
  }

  show(...views: View[]): void {
    this.#app.stage.addChild(...views.map((view) => view.container))
  }

  hide(...views: View[]): void {
    this.#app.stage.removeChild(...views.map((view) => view.container))
  }
}
