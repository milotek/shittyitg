/**
 * Converts a simfile into a song folder: notes.json and manifest.json from the .sm, and the
 * audio and background it names, as audio.ogg and bg.png. mods.json is never touched, so a
 * modchart survives the steps being reconverted.
 *
 * Usage: node src/tools/sm2json/sm2json.ts <song.sm> <slug>
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import type { ModsFile } from '../../engine/mods/schema.ts'
import type { Manifest, NotesFile } from '../../engine/notes/notes.ts'
import { Timing } from '../../engine/timing/timing.ts'
import { parseSimfile } from './parse.ts'

const [source, slug] = process.argv.slice(2)
if (!source || !slug || !/^[a-z0-9_]+$/.test(slug)) {
  console.error('usage: node src/tools/sm2json/sm2json.ts <song.sm> <slug>, slug in [a-z0-9_]')
  process.exit(2)
}

const song = parseSimfile(readFileSync(source, 'utf8'))
const from = dirname(source)
const out = join(import.meta.dirname, '../../../public/songs', slug)
mkdirSync(out, { recursive: true })

/** Copies when the source is already the target format, and transcodes through ffmpeg otherwise. */
function bring(name: string, target: string, codec: string[]): boolean {
  if (!name) return false
  const path = join(from, name)
  if (!existsSync(path)) throw new Error(`the simfile names ${name}, which is not beside it`)
  if (extname(name).toLowerCase() === extname(target)) copyFileSync(path, join(out, target))
  else
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      path,
      ...codec,
      '-fflags',
      '+bitexact',
      join(out, target),
    ])
  return true
}

bring(song.music, 'audio.ogg', ['-vn', '-c:a', 'libvorbis', '-q:a', '6', '-flags:a', '+bitexact'])
const background = bring(song.background, 'bg.png', ['-frames:v', '1'])

const timing = new Timing(song.timing)
const span = (values: number[]) => {
  const [low, high] = [Math.min(...values), Math.max(...values)].map(Math.round)
  return low === high ? String(low) : `${low}-${high}`
}
// `*` is StepMania's "hide the BPM"; anything else it can say is one or two numbers.
const shown = song.displayBpm.split(':').map(Number)
const bpm =
  song.displayBpm && shown.every(Number.isFinite)
    ? span(shown)
    : span(song.timing.bpms.map((b) => b.bpm))

const notes: NotesFile = { timing: song.timing, charts: song.charts }
const manifest: Manifest = {
  title: song.title + (song.subtitle ? ` ${song.subtitle}` : ''),
  artist: song.artist,
  bpm,
  audio: 'audio.ogg',
  ...(background ? { background: 'bg.png' } : {}),
  preview: song.sampleStart || Math.max(timing.secondAt(32), 0),
  difficulties: song.charts.map((c) => ({ name: c.difficulty, meter: c.meter })),
}

writeFileSync(join(out, 'notes.json'), `${JSON.stringify(notes)}\n`)
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
if (!existsSync(join(out, 'mods.json'))) {
  const empty: ModsFile = { rows: [] }
  writeFileSync(join(out, 'mods.json'), `${JSON.stringify(empty, null, 2)}\n`)
}

const counts = song.charts
  .map((c) => `${c.difficulty} ${c.meter}: ${c.notes.length} notes`)
  .join(', ')
console.log(`${slug}: ${counts} -> ${out}`)
