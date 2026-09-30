import type { ModsFile } from '../engine/mods/schema.ts'
import type { Manifest, NotesFile } from '../engine/notes/notes.ts'

export type SongFiles = {
  slug: string
  base: string
  manifest: Manifest
  notes: NotesFile
  mods: ModsFile
}

export async function loadSong(slug: string): Promise<SongFiles> {
  const base = `songs/${slug}/`
  const json = async <T>(file: string): Promise<T> => {
    const response = await fetch(base + file)
    if (!response.ok) throw new Error(`could not load ${base}${file}: ${response.status}`)
    return (await response.json()) as T
  }
  const [manifest, notes, mods] = await Promise.all([
    json<Manifest>('manifest.json'),
    json<NotesFile>('notes.json'),
    json<ModsFile>('mods.json'),
  ])
  return { slug, base, manifest, notes, mods }
}
