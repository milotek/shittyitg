import { Buffer, BufferUsage, Geometry, Mesh, Shader, type Texture } from 'pixi.js'
import type { DrawList } from '../../engine/draw/drawlist.ts'

const vertex = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
in float aGlow;

out vec2 vUV;
out vec4 vColor;
out float vGlow;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vColor = aColor;
  vGlow = aGlow;
}
`

const fragment = /* glsl */ `
in vec2 vUV;
in vec4 vColor;
in float vGlow;

uniform sampler2D uTexture;

out vec4 finalColor;

void main() {
  vec4 texel = texture(uTexture, vUV);
  finalColor = texel * vColor + vec4(vec3(vGlow * texel.a), 0.0);
}
`

/**
 * Every quad in the draw list, as one mesh over one atlas: one buffer, one pipeline state, one
 * draw call. The buffers are sized once and rewritten in place each frame.
 */
export class QuadMesh {
  readonly view: Mesh<Geometry, Shader>
  readonly #positions: Buffer
  readonly #uvs: Buffer
  readonly #colors: Buffer
  readonly #glows: Buffer
  readonly #geometry: Geometry

  constructor(texture: Texture, capacity: number) {
    const buffer = (data: Float32Array | Uint32Array) =>
      new Buffer({ data, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST })
    this.#positions = buffer(new Float32Array(capacity * 8))
    this.#uvs = buffer(new Float32Array(capacity * 8))
    this.#colors = buffer(new Uint32Array(capacity * 4))
    this.#glows = buffer(new Float32Array(capacity * 4))

    const indices = new Uint32Array(capacity * 6)
    for (let q = 0; q < capacity; q++) {
      indices.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6)
    }

    this.#geometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.#positions, format: 'float32x2' },
        aUV: { buffer: this.#uvs, format: 'float32x2' },
        aColor: { buffer: this.#colors, format: 'unorm8x4' },
        aGlow: { buffer: this.#glows, format: 'float32' },
      },
      indexBuffer: indices,
    })

    const shader = Shader.from({
      gl: { vertex, fragment, name: 'shititg-quads' },
      resources: { uTexture: texture.source },
    })

    this.view = new Mesh({ geometry: this.#geometry, shader })
  }

  upload(list: DrawList): void {
    const order = list.order()
    const positions = this.#positions.data as Float32Array
    const uvs = this.#uvs.data as Float32Array
    const colors = this.#colors.data as Uint32Array
    const glows = this.#glows.data as Float32Array

    for (let slot = 0; slot < order.length; slot++) {
      const quad = order[slot] as number
      positions.set(list.positions.subarray(quad * 8, quad * 8 + 8), slot * 8)
      uvs.set(list.uvs.subarray(quad * 8, quad * 8 + 8), slot * 8)
      colors.fill(list.colors[quad] as number, slot * 4, slot * 4 + 4)
      glows.fill(list.glows[quad] as number, slot * 4, slot * 4 + 4)
    }

    const count = order.length
    this.#positions.update(count * 8 * 4)
    this.#uvs.update(count * 8 * 4)
    this.#colors.update(count * 4 * 4)
    this.#glows.update(count * 4 * 4)
    this.#geometry.indexCount = count * 6
    this.view.visible = count > 0
  }
}
