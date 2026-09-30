/** Arrows for one hand on a keyboard, DFJK for two. Either set drives the same four columns. */
const KEYS: Record<string, number> = {
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowUp: 2,
  ArrowRight: 3,
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
}

/**
 * Reports presses with the event's own timestamp, never the frame that noticed them: polling
 * once a frame would bake up to a frame's worth of error into every hit.
 */
export function bindInput(
  press: (column: number, timeStamp: number) => void,
  release: (column: number, timeStamp: number) => void,
): () => void {
  const down = new Set<string>()
  const held = (column: number) => [...down].some((code) => KEYS[code] === column)

  const onDown = (event: KeyboardEvent) => {
    const column = KEYS[event.code]
    if (column === undefined) return
    event.preventDefault()
    if (event.repeat || down.has(event.code)) return
    const already = held(column)
    down.add(event.code)
    if (!already) press(column, event.timeStamp)
  }

  const onUp = (event: KeyboardEvent) => {
    const column = KEYS[event.code]
    if (column === undefined || !down.delete(event.code)) return
    if (!held(column)) release(column, event.timeStamp)
  }

  // Losing focus swallows the keyup, which would otherwise leave a column held forever.
  const onBlur = () => {
    for (const code of down) release(KEYS[code] as number, performance.now())
    down.clear()
  }

  addEventListener('keydown', onDown)
  addEventListener('keyup', onUp)
  addEventListener('blur', onBlur)
  return () => {
    removeEventListener('keydown', onDown)
    removeEventListener('keyup', onUp)
    removeEventListener('blur', onBlur)
  }
}
