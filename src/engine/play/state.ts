/** What has happened to each note, written by play and read by the notefield. */
export const NoteState = {
  pending: 0,
  /** Taps and mines that were hit, and holds that were held to the end. All three stop drawing. */
  gone: 1,
  missed: 2,
  holding: 3,
  /** A hold let go early, or whose head was missed. It keeps scrolling, greyed out. */
  dropped: 4,
} as const

export type NoteStateValue = (typeof NoteState)[keyof typeof NoteState]
