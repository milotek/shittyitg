/**
 * Writes the click-track song: a metronome and a chart covering every note kind and quant, so the
 * engine can be checked against something whose timing is known exactly.
 *
 * Usage: node src/tools/clicktrack/clicktrack.ts
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ModsFile } from '../../engine/mods/schema.ts'
import { type Manifest, type Note, type NotesFile, quantOf } from '../../engine/notes/notes.ts'

const BPM = 130
const MEASURES = 36
const RATE = 44100
const OUT = join(import.meta.dirname, '../../../public/songs/clicktrack')

function audio(): Buffer {
  const seconds = (MEASURES * 4 * 60) / BPM + 2
  const samples = new Float32Array(Math.ceil(seconds * RATE))

  for (let beat = 0; beat < MEASURES * 4; beat++) {
    const start = Math.round(((beat * 60) / BPM) * RATE)
    const downbeat = beat % 4 === 0
    const pitch = downbeat ? 1760 : 1320
    for (let i = 0; i < RATE * 0.06; i++) {
      const t = i / RATE
      const envelope = Math.exp(-t * 70)
      const index = start + i
      if (index < samples.length) {
        samples[index] = (samples[index] ?? 0) + Math.sin(2 * Math.PI * pitch * t) * envelope * 0.6
      }
    }
  }

  const wav = Buffer.alloc(44 + samples.length * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + samples.length * 2, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(RATE, 24)
  wav.writeUInt32LE(RATE * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((s, i) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2)
  })
  return wav
}

function chart(): Note[] {
  const notes: Note[] = []
  const tap = (beat: number, column: number) =>
    notes.push({ beat, column, kind: 'tap', quant: quantOf(beat) })
  const long = (kind: 'hold' | 'roll', beat: number, column: number, length: number) =>
    notes.push({ beat, column, kind, quant: quantOf(beat), endBeat: beat + length })
  const mine = (beat: number, column: number) =>
    notes.push({ beat, column, kind: 'mine', quant: quantOf(beat) })

  const walk = [0, 1, 2, 3, 2, 1]
  const sections = [
    (b: number) => [0, 1, 2, 3].forEach((i) => tap(b + i, i)),
    (b: number) => [0, 1, 2, 3].forEach((i) => tap(b + i, 3 - i)),
    (b: number) => [...Array(8).keys()].forEach((i) => tap(b + i / 2, walk[i % 6] as number)),
    (b: number) =>
      [0, 1, 2, 3].forEach((i) => [i % 2 ? 1 : 0, i % 2 ? 2 : 3].forEach((c) => tap(b + i, c))),
    (b: number) => [...Array(16).keys()].forEach((i) => tap(b + i / 4, walk[i % 6] as number)),
    (b: number) => {
      long('hold', b, 0, 2)
      long('hold', b + 2, 3, 2)
      tap(b + 1, 2)
      tap(b + 3, 1)
    },
    (b: number) => {
      long('roll', b, 1, 3)
      ;[0, 1, 2, 3].forEach((i) => tap(b + i, 3))
    },
    (b: number) =>
      [0, 1, 2, 3].forEach((i) => {
        mine(b + i, i)
        tap(b + i + 0.5, 3 - i)
      }),
    (b: number) => [...Array(12).keys()].forEach((i) => tap(b + i / 3, walk[i % 6] as number)),
    (b: number) => [...Array(8).keys()].forEach((i) => tap(b + i / 2 + (i % 2 ? 1 / 6 : 0), i % 4)),
    (b: number) => [...Array(8).keys()].forEach((i) => tap(b + i / 8, i % 4)),
  ]

  for (let measure = 1; measure < MEASURES - 1; measure++) {
    ;(sections[(measure - 1) % sections.length] as (b: number) => void)(measure * 4)
  }
  return notes.sort((a, b) => a.beat - b.beat || a.column - b.column)
}

const mods: ModsFile = {
  rows: [
    { beat: 0, len: 0, ease: 'instant', set: { xmod: 2.25 } },
    { beat: 16, len: 4, ease: 'inOutSine', set: { drunk: 100 } },
    { beat: 48, len: 4, ease: 'inOutSine', set: { drunk: 0 } },
  ],
}

const notes: NotesFile = {
  timing: { offset: 0, bpms: [{ beat: 0, bpm: BPM }], stops: [] },
  charts: [{ difficulty: 'Challenge', meter: 5, notes: chart() }],
}

const manifest: Manifest = {
  title: 'Click Track',
  artist: 'shitITG',
  bpm: String(BPM),
  audio: 'audio.ogg',
  preview: 8,
  difficulties: notes.charts.map((c) => ({ name: c.difficulty, meter: c.meter })),
  fixture: true,
}

mkdirSync(OUT, { recursive: true })
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'wav',
    '-i',
    '-',
    '-c:a',
    'libvorbis',
    '-q:a',
    '4',
    // Ogg picks a random stream serial per encode; bit-exact keeps a rerun from churning the file.
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    join(OUT, 'audio.ogg'),
  ],
  {
    input: audio(),
  },
)
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(join(OUT, 'notes.json'), `${JSON.stringify(notes)}\n`)
writeFileSync(join(OUT, 'mods.json'), `${JSON.stringify(mods, null, 2)}\n`)
console.log(`clicktrack: ${notes.charts[0]?.notes.length} notes -> ${OUT}`)
