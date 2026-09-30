declare module 'virtual:songs' {
  import type { Manifest } from '../../engine/notes/notes.ts'

  const songs: { slug: string; manifest: Manifest }[]
  export default songs
}
