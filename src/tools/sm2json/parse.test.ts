import { describe, expect, it } from 'vitest'
import { parseSimfile } from './parse.ts'

const simfile = (notes: string, extra = '') => `
#TITLE:Test Song;
#ARTIST:Someone;
#MUSIC:song.ogg;
#OFFSET:-0.050;
#BPMS:0.000=120.000,
8.000=240.000;
#STOPS:4.000=0.500;
${extra}
// a comment with a ; that must not end anything
#NOTES:
     dance-single:
     :
     Challenge:
     11:
     0,0,0,0,0:
${notes}
;
`

describe('parseSimfile', () => {
  it('reads metadata and timing', () => {
    const song = parseSimfile(simfile('1000\n0000\n0000\n0000'))
    expect(song.title).toBe('Test Song')
    expect(song.timing).toEqual({
      offset: -0.05,
      bpms: [
        { beat: 0, bpm: 120 },
        { beat: 8, bpm: 240 },
      ],
      stops: [{ beat: 4, seconds: 0.5 }],
    })
    expect(song.charts[0]).toMatchObject({ difficulty: 'Challenge', meter: 11 })
  })

  it('places rows by their share of the measure and works out each quant', () => {
    const song = parseSimfile(
      simfile('1000\n0100\n0010\n0001\n0000\n0000\n1000\n0000\n,\n0000\n0000\n0000\n1001'),
    )
    expect(song.charts[0]?.notes.map((n) => [n.beat, n.column, n.quant])).toEqual([
      [0, 0, 4],
      [0.5, 1, 8],
      [1, 2, 4],
      [1.5, 3, 8],
      [3, 0, 4],
      [7, 0, 4],
      [7, 3, 4],
    ])
  })

  it('closes holds and rolls on their tails and reads mines', () => {
    const song = parseSimfile(simfile('2004\nM000\n3000\n0003'))
    expect(song.charts[0]?.notes).toEqual([
      { beat: 0, column: 0, kind: 'hold', quant: 4, endBeat: 2 },
      { beat: 0, column: 3, kind: 'roll', quant: 4, endBeat: 3 },
      { beat: 1, column: 0, kind: 'mine', quant: 4 },
    ])
  })

  it('skips charts for other game types', () => {
    const song = parseSimfile(
      simfile(
        '1000\n0000\n0000\n0000',
        '#NOTES:dance-double::Hard:9::00000000\n00000000\n00000000\n00000000;',
      ),
    )
    expect(song.charts).toHaveLength(1)
  })

  it('refuses a hold with no tail', () => {
    expect(() => parseSimfile(simfile('2000\n0000\n0000\n0000'))).toThrow(/never ends/)
  })

  it('refuses warps rather than playing them wrong', () => {
    expect(() => parseSimfile(simfile('1000', '#BPMS:0=120,4=-120,5=120;'))).toThrow(/warps/)
  })
})
