import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const SONGS = join(import.meta.dirname, 'public/songs')

/**
 * A static site cannot list a directory, so the song list is read from `public/songs` at build
 * time. Adding a song stays a matter of dropping its folder in, with no index to keep in step.
 */
function songs(): Plugin {
  const id = 'virtual:songs'
  const resolved = `\0${id}`
  return {
    name: 'shititg-songs',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(target) {
      if (target !== resolved) return
      const list = readdirSync(SONGS, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          slug: entry.name,
          manifest: JSON.parse(readFileSync(join(SONGS, entry.name, 'manifest.json'), 'utf8')),
        }))
      return `export default ${JSON.stringify(list)}`
    },
    configureServer(server) {
      server.watcher.add(SONGS)
      server.watcher.on('all', (_event, path) => {
        if (!path.startsWith(SONGS) || !path.endsWith('manifest.json')) return
        const module = server.moduleGraph.getModuleById(resolved)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

export default defineConfig({
  base: './',
  build: { target: 'es2023' },
  plugins: [songs()],
  test: { include: ['src/**/*.test.ts'] },
})
