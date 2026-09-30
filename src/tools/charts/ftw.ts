/**
 * The ftw modchart, written as phrases rather than a thousand hand-typed rows. What ships is the
 * mods.json this writes; the engine never sees this file. Remade to the original's feel, not its
 * values.
 *
 * Usage: node src/tools/charts/ftw.ts
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EaseName } from '../../engine/mods/ease.ts'
import type { ModRow, ModsFile } from '../../engine/mods/schema.ts'

const rows: ModRow[] = []

const set = (beat: number, len: number, ease: EaseName, mods: Record<string, number>) => {
  rows.push({ beat, len, ease, set: mods })
}

/** A gesture that leaves the mod where it found it. */
const hit = (beat: number, len: number, mods: Record<string, number>, ease: EaseName = 'pop') =>
  set(beat, len, ease, mods)

const every = (from: number, to: number, step: number, fn: (beat: number, i: number) => void) => {
  for (let beat = from, i = 0; beat < to - 1e-9; beat += step, i++) fn(beat, i)
}

/** A mod thrown one way, then the other, settling back to rest. */
const wiggle = (beat: number, step: number, count: number, mod: string, amount: number) => {
  every(beat, beat + step * count, step, (b, i) => {
    const fade = 1 - i / count
    set(b, step, 'outCubic', { [mod]: (i % 2 ? -amount : amount) * fade })
  })
  set(beat + step * count, step, 'outCubic', { [mod]: 0 })
}

/** The kick: the field is pulled toward its centre and let go on every beat in range. */
const kicks = (from: number, to: number, amount: number, step = 1) =>
  every(from, to, step, (b) => hit(b, step * 0.9, { centered: amount }))

// The field arrives out of the distance with its receptors dark, and snaps into place on the pickup.
set(0, 0, 'instant', { xmod: 2.25, dark: 100, distant: 180, mini: 60, rotationz: -25, drunk: 40 })
set(4, 12, 'outCubic', { dark: 0 })
set(8, 20, 'inOutSine', { distant: 0, mini: 0, rotationz: 0 })
set(24, 4, 'inQuad', { brake: 60, drunk: 0 })
set(28, 2, 'outBack', { brake: 0 })
set(30.5, 0.25, 'outQuad', { flip: 100 })
set(30.75, 0.25, 'outQuad', { flip: 0, invert: 100 })
set(31, 0.5, 'outQuad', { flip: 75, invert: -125 })
set(31.5, 0.5, 'outBack', { flip: 0, invert: 0 })

// Verse: a constant sway underneath, and the kick pulling on it.
set(32, 4, 'outSine', { drunk: 60, tipsy: 35 })
kicks(32, 64, 18, 2)
every(40, 64, 8, (b, i) => hit(b - 0.5, 1, { [i % 2 ? 'invert' : 'flip']: 55 }, 'bell'))
set(48, 4, 'inOutSine', { beat: 100 })
set(62, 2, 'inQuad', { beat: 0, drunk: 20, tipsy: 0 })

// Holds: lean the field down a hallway and let tornado bend every body through it.
set(64, 4, 'outCubic', { hallway: 40, tornado: 25, drunk: 60 })
every(64, 96, 4, (b, i) => hit(b, 2, { confusionoffset: i % 2 ? -25 : 25 }, 'tri'))
set(80, 2, 'outBack', { split: 100 })
set(88, 2, 'outBack', { split: 0 })
set(94, 2, 'inOutQuad', { hallway: 0, tornado: 0, drunk: 30 })

// Build: the kick gets harder and the scroll starts to pump.
set(96, 8, 'linear', { tipsy: 50, drunk: 70 })
kicks(96, 128, 25)
every(96, 128, 2, (b) => hit(b + 1, 0.9, { boost: 90 }))
every(104, 128, 8, (b, i) =>
  set(b, 2, 'outBack', { incoming: i % 2 ? 0 : 40, space: i % 2 ? 40 : 0 }),
)
set(128, 4, 'outQuad', { incoming: 0, space: 0, wave: 60 })
kicks(128, 144, 35, 0.5)
every(128, 144, 1, (b, i) => hit(b + 0.5, 0.5, { movey: i % 2 ? -18 : 18 }, 'tri'))

// First drop: everything at once, then gone.
set(144, 0.5, 'outExpo', { dizzy: 35, tornado: 70, wave: 0, drunk: 110 })
every(144, 152, 0.5, (b, i) => hit(b, 0.5, { flip: i % 2 ? 35 : -35 }, 'tap'))
every(144, 152, 1, (b) => hit(b, 1, { mini: -40 }))
set(152, 1, 'outExpo', { dizzy: 0, tornado: 0, drunk: 0, tipsy: 0 })
hit(152, 4, { centered: 100, rotationz: 20 }, 'outBounce')
set(156, 4, 'inOutSine', { centered: 0, rotationz: 0 })

// Breakdown: barely any notes, so the field is free to come apart.
set(160, 16, 'inOutSine', { distant: 90, rotationz: 180, drunk: 50, tipsy: 60 })
set(176, 8, 'inOutCubic', { distant: 0, hallway: 70, reverse: 100 })
set(184, 16, 'inOutSine', { rotationz: 360, twirl: 15, mini: 35 })
set(200, 8, 'inOutCubic', { hallway: 0, incoming: 80, reverse: 0, twirl: 0 })
set(200, 0, 'instant', { rotationz: 0 })
wiggle(208, 1, 8, 'confusionoffset', 45)
set(216, 8, 'inOutSine', { incoming: 0, space: 80, roll: 12, bumpy: 80 })
set(224, 8, 'inOutSine', { space: 0, roll: 0, bumpy: 0, mini: 0, sudden: 100, suddenoffset: 40 })
set(232, 8, 'inOutSine', { sudden: 0, hidden: 100, hiddenoffset: -30 })
set(240, 8, 'inOutSine', { hidden: 0, rotationy: 35, drunk: 90 })
// The wag: flip and invert swapped every beat, deepening as it goes.
every(248, 264, 1, (b, i) => {
  const depth = (i + 1) / 16
  set(b, 1, 'outBack', {
    invert: (i % 2 ? 1 : -1) * 75 * depth,
    flip: 38 * depth,
    mini: -30 * depth,
  })
})
set(262, 2, 'inQuad', { rotationy: 0, drunk: 30, tipsy: 30 })

// Re-entry: straighten up hard on the downbeat.
set(264, 0.5, 'outExpo', { invert: 0, flip: 0, mini: 0 })
hit(264, 2, { centered: 100 }, 'outBounce')
kicks(264, 280, 25, 2)
every(266, 280, 4, (b, i) => wiggle(b, 0.25, 4, i % 2 ? 'tipsy' : 'movex', 60))

// Holds, split field: halves scroll opposite ways and the bodies ripple.
set(280, 4, 'outCubic', { alternate: 100, bumpy: 60, drunk: 60 })
set(296, 4, 'inOutCubic', { alternate: 0, cross: 100 })
set(304, 8, 'inOutSine', { cross: 0, distant: 60, tornado: 40 })
set(320, 4, 'inOutSine', { distant: 0, tornado: 0, bumpy: 0, split: 100 })
set(332, 4, 'inOutCubic', { split: 0, drunk: 40 })

// Second drop, heavier: the perspective swings side to side every bar.
kicks(336, 408, 30)
every(336, 400, 4, (b, i) =>
  set(b, 2, 'outBack', { incoming: i % 2 ? 0 : 60, space: i % 2 ? 60 : 0 }),
)
every(344, 400, 2, (b) => hit(b + 1, 0.9, { boost: 110 }))
every(352, 368, 1, (b, i) => hit(b + 0.5, 0.5, { brake: i % 2 ? 0 : 120 }))
set(368, 8, 'inOutSine', { confusion: 30, dizzy: 20 })
set(376, 4, 'inOutSine', { confusion: 0, dizzy: 0, beat: 150 })
set(400, 4, 'inQuad', { incoming: 0, space: 0, drunk: 60 })
every(400, 408, 0.5, (b, i) => hit(b, 0.5, { movey: i % 2 ? -25 : 25 }, 'tri'))
every(408, 416, 1, (b, i) => hit(b, 0.5, { movey: i % 2 ? -30 : 30 }, 'tap'))
every(408, 416, 1, (b) => hit(b, 0.5, { stealth: 45 }, 'spike'))

// Collapse into the gap, then rebuild.
set(416, 4, 'inOutExpo', { beat: 0, tornado: 0, mini: 100, rotationz: 180, dark: 60, drunk: 0 })
set(428, 8, 'inOutSine', { mini: 0, rotationz: 360, dark: 0 })
set(436, 0, 'instant', { rotationz: 0 })
set(436, 4, 'inQuad', { brake: 80 })
set(440, 1, 'outBack', { brake: 0 })

// Holds again, upside down this time.
set(440, 2, 'outBack', { reverse: 100, drunk: 70, bumpy: 60 })
kicks(440, 496, 20, 2)
set(456, 4, 'inOutCubic', { reverse: 0, split: 100 })
set(464, 8, 'inOutSine', { split: 0, hallway: 60, tornado: 45 })
set(480, 4, 'inOutSine', { hallway: 0, tornado: 0, alternate: 100 })
set(492, 4, 'inOutCubic', { alternate: 0, bumpy: 0 })

// Outro: a last flourish, then the field walks back out into the distance.
wiggle(496, 0.5, 8, 'invert', 80)
set(504, 8, 'inOutSine', { drunk: 30, tipsy: 30 })
set(512, 12, 'inCubic', { distant: 180, stealth: 100, dark: 100, mini: 40 })

const mods: ModsFile = { rows: rows.sort((a, b) => a.beat - b.beat) }
const out = join(import.meta.dirname, '../../../public/songs/ftw/mods.json')
writeFileSync(out, `${JSON.stringify(mods)}\n`)
console.log(`ftw: ${rows.length} rows -> ${out}`)
