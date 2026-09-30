import { type Chart, type Note, quantOf } from '../../engine/notes/notes.ts'
import type { TimingData } from '../../engine/timing/timing.ts'

export type Simfile = {
  title: string
  subtitle: string
  artist: string
  music: string
  background: string
  sampleStart: number
  displayBpm: string
  timing: TimingData
  charts: Chart[]
}

const COLUMNS = 4

/** `#TAG:value;` pairs, in order. Values may span lines and contain colons. */
function tags(text: string): [string, string][] {
  const stripped = text.replace(/\/\/[^\n]*/g, '')
  const found: [string, string][] = []
  for (const match of stripped.matchAll(/#([A-Z0-9]+):([^;]*);/gi)) {
    found.push([(match[1] as string).toUpperCase(), (match[2] as string).trim()])
  }
  return found
}

function pairs(value: string): [number, number][] {
  return value
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [left, right] = pair.split('=').map(Number)
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error(`bad pair "${pair}"`)
      return [left as number, right as number]
    })
}

/**
 * Note rows, one measure at a time. `3` closes whichever hold or roll is open in that column; a
 * lift is played as a tap, and fakes and keysounds are dropped because nothing here plays them.
 */
function notes(data: string): Note[] {
  const out: Note[] = []
  const open: (Note | undefined)[] = new Array(COLUMNS).fill(undefined)
  const measures = data.split(',')

  measures.forEach((measure, index) => {
    const rows = measure
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean)
    rows.forEach((row, r) => {
      if (row.length !== COLUMNS) throw new Error(`measure ${index} has a ${row.length}-column row`)
      const beat = index * 4 + (r / rows.length) * 4
      for (let column = 0; column < COLUMNS; column++) {
        const symbol = row[column]
        const quant = quantOf(beat)
        if (symbol === '1' || symbol === 'L') out.push({ beat, column, kind: 'tap', quant })
        else if (symbol === 'M') out.push({ beat, column, kind: 'mine', quant })
        else if (symbol === '2' || symbol === '4') {
          const note: Note = {
            beat,
            column,
            kind: symbol === '2' ? 'hold' : 'roll',
            quant,
            endBeat: beat,
          }
          open[column] = note
          out.push(note)
        } else if (symbol === '3') {
          const head = open[column]
          if (!head) throw new Error(`tail without a head at beat ${beat}, column ${column}`)
          head.endBeat = beat
          open[column] = undefined
        }
      }
    })
  })

  const unclosed = open.find(Boolean)
  if (unclosed) throw new Error(`hold at beat ${unclosed.beat} never ends`)
  return out.sort((a, b) => a.beat - b.beat || a.column - b.column)
}

export function parseSimfile(text: string): Simfile {
  const values = new Map<string, string>()
  const charts: Chart[] = []

  for (const [tag, value] of tags(text)) {
    if (tag !== 'NOTES') {
      values.set(tag, value)
      continue
    }
    const [type, , difficulty, meter, , data] = value.split(':').map((part) => part.trim())
    if (type !== 'dance-single' || data === undefined) continue
    charts.push({ difficulty: difficulty ?? 'Edit', meter: Number(meter) || 0, notes: notes(data) })
  }

  const bpms = pairs(values.get('BPMS') ?? '').map(([beat, bpm]) => ({ beat, bpm }))
  if (bpms.length === 0) throw new Error('no #BPMS')
  if (bpms.some((b) => b.bpm <= 0))
    throw new Error('negative and zero BPMs are warps, which are not supported')
  const stops = pairs(values.get('STOPS') ?? values.get('FREEZES') ?? '').map(
    ([beat, seconds]) => ({
      beat,
      seconds,
    }),
  )
  if (stops.some((s) => s.seconds < 0))
    throw new Error('negative stops are warps, which are not supported')
  if (charts.length === 0) throw new Error('no dance-single charts')

  return {
    title: values.get('TITLE') ?? '',
    subtitle: values.get('SUBTITLE') ?? '',
    artist: values.get('ARTIST') ?? '',
    music: values.get('MUSIC') ?? '',
    background: values.get('BACKGROUND') ?? '',
    sampleStart: Number(values.get('SAMPLESTART') ?? 0) || 0,
    displayBpm: values.get('DISPLAYBPM') ?? '',
    timing: { offset: Number(values.get('OFFSET') ?? 0), bpms, stops },
    charts,
  }
}
