import songs from 'virtual:songs'
import type { Manifest } from '../../engine/notes/notes.ts'

export type Choice = { slug: string; chart: number }

type Entry = { slug: string; manifest: Manifest }

/** Seconds the preview fades in over, so it never starts on a click. */
const PREVIEW_FADE = 0.6

/**
 * The song wheel. Plain DOM: it is text and layout, and the renderer stays the only thing that
 * knows Pixi exists. Remembers where it was left, so backing out of a song lands back on it.
 */
export class SongSelect {
  readonly #root: HTMLElement
  readonly #list: HTMLOListElement
  readonly #entries: Entry[]
  #index = 0
  #chart = 0
  #preview: HTMLAudioElement | undefined
  #fade = 0

  constructor() {
    this.#entries = [...songs].sort((a, b) => a.manifest.title.localeCompare(b.manifest.title))
    this.#root = document.createElement('section')
    this.#root.id = 'select'
    this.#root.hidden = true
    this.#root.innerHTML = `
      <div class="backdrop"></div>
      <ol class="wheel"></ol>
      <aside class="info">
        <p class="artist"></p>
        <h1 class="title"></h1>
        <dl>
          <div><dt>BPM</dt><dd class="bpm"></dd></div>
          <div><dt>Chart</dt><dd class="difficulty"></dd></div>
        </dl>
        <p class="hint"><kbd>↑</kbd><kbd>↓</kbd> song <kbd>←</kbd><kbd>→</kbd> chart <kbd>enter</kbd> play <kbd>esc</kbd> back out of a song</p>
      </aside>
    `
    this.#list = this.#root.querySelector('.wheel') as HTMLOListElement
    this.#list.append(
      ...this.#entries.map((entry, index) => {
        const item = document.createElement('li')
        item.innerHTML = `<span class="name"></span><span class="by"></span>`
        ;(item.querySelector('.name') as HTMLElement).textContent = entry.manifest.title
        ;(item.querySelector('.by') as HTMLElement).textContent = entry.manifest.artist
        item.addEventListener('click', () => this.#move(index - this.#index))
        return item
      }),
    )
    document.body.append(this.#root)
  }

  /** Shows the wheel and resolves with whatever the player starts. */
  choose(): Promise<Choice> {
    this.#root.hidden = false
    this.#render()
    return new Promise((resolve) => {
      const finish = () => {
        removeEventListener('keydown', onKey)
        this.#list.removeEventListener('dblclick', onDouble)
        this.#root.removeEventListener('wheel', onWheel)
        this.#stopPreview()
        this.#root.hidden = true
        resolve({ slug: (this.#entries[this.#index] as Entry).slug, chart: this.#chart })
      }
      const onKey = (event: KeyboardEvent) => {
        const moves: Record<string, () => void> = {
          ArrowUp: () => this.#move(-1),
          ArrowDown: () => this.#move(1),
          ArrowLeft: () => this.#difficulty(-1),
          ArrowRight: () => this.#difficulty(1),
          Enter: finish,
          Space: finish,
        }
        const action = moves[event.code]
        if (!action || event.repeat) return
        event.preventDefault()
        action()
      }
      const onDouble = () => finish()
      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        this.#move(Math.sign(event.deltaY))
      }
      addEventListener('keydown', onKey)
      this.#list.addEventListener('dblclick', onDouble)
      this.#root.addEventListener('wheel', onWheel, { passive: false })
    })
  }

  #move(by: number): void {
    const count = this.#entries.length
    const next = (((this.#index + by) % count) + count) % count
    if (next === this.#index && by !== 0) return
    this.#index = next
    this.#chart = 0
    this.#render()
  }

  #difficulty(by: number): void {
    const count = (this.#entries[this.#index] as Entry).manifest.difficulties.length
    this.#chart = Math.min(Math.max(this.#chart + by, 0), count - 1)
    this.#render()
  }

  #render(): void {
    const entry = this.#entries[this.#index] as Entry
    const { manifest, slug } = entry
    const base = `songs/${slug}/`

    this.#list.style.setProperty('--index', String(this.#index))
    this.#list.querySelectorAll('li').forEach((item, index) => {
      item.classList.toggle('selected', index === this.#index)
    })

    const set = (selector: string, text: string) => {
      ;(this.#root.querySelector(selector) as HTMLElement).textContent = text
    }
    const difficulty = manifest.difficulties[this.#chart]
    set('.title', manifest.title)
    set('.artist', manifest.artist)
    set('.bpm', manifest.bpm)
    set('.difficulty', difficulty ? `${difficulty.name} ${difficulty.meter}` : '')

    const backdrop = this.#root.querySelector('.backdrop') as HTMLElement
    backdrop.style.backgroundImage = manifest.background
      ? `url("${base}${manifest.background}")`
      : ''

    this.#playPreview(base + manifest.audio, manifest.preview)
  }

  #playPreview(url: string, from: number): void {
    const current = this.#preview
    if (current && new URL(current.src).pathname.endsWith(url)) return
    this.#stopPreview()
    const audio = new Audio(url)
    audio.currentTime = from
    audio.volume = 0
    audio.loop = true
    this.#preview = audio
    // A preview that cannot play, because the page has not been interacted with yet, is not an error.
    audio.play().catch(() => undefined)
    const started = performance.now()
    const fade = () => {
      if (this.#preview !== audio) return
      audio.volume = Math.min((performance.now() - started) / 1000 / PREVIEW_FADE, 1) * 0.8
      if (audio.volume < 0.8) this.#fade = requestAnimationFrame(fade)
    }
    this.#fade = requestAnimationFrame(fade)
  }

  #stopPreview(): void {
    cancelAnimationFrame(this.#fade)
    this.#preview?.pause()
    this.#preview = undefined
  }
}
