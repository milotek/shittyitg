# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy>=2", "pillow>=11"]
# ///
"""Bakes Peter's Scalable Cel into one atlas and a manifest the renderer reads.

Usage: uv run src/tools/noteskin/bake.py
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from milkshape import Mesh, read_meshes
from PIL import Image

UPSTREAM = "Pete-Lawrence/Peters-Noteskins"
COMMIT = "6faea8e1a17a76beeb2a3dd1000f3f703c4e52f6"
SKIN = "Not-ITG/peters-scalable-cel-HD"

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / ".cache" / "peters-scalable-cel-HD"
OUT = ROOT / "public" / "noteskin"

# The tap mesh spans -32..32 source units, which is the definition of one cell.
CELL_UNITS = 64.0
CELL_PIXELS = 256
SUPERSAMPLE = 4
PAD = 4
ATLAS_WIDTH = 4096

# metrics.ini: TapNoteAnimationLengthInBeats=2, TapMineAnimationLengthInBeats=1.
TAP_FRAMES, TAP_BEATS = 16, 2
MINE_FRAMES, MINE_BEATS = 16, 1

# Each quant's ani texture.ini shifts the atlas sideways onto its colour ramp.
QUANTS = {4: "4th", 8: "8th", 12: "12th", 16: "16th", 32: "32nd", 64: "64th"}
QUANT_OFFSET_U = {4: 0.0, 8: 0.0625, 12: 0.125, 16: 0.1875, 32: 0.25, 64: 0.375}

# Only these parts take the scroll. The frame and the mine body share the same
# texture but sit on regions that would slide into the colour ramps if moved.
TAP_COLOUR_MESH = "colourboi"
MINE_PULSE_MESH = "red"

# "(doubleres)" sprites are drawn at half their pixel size: 128 px is one cell.
SPRITES = {
    "receptor": ("_Down Receptor tex (doubleres).png", 128),
    "holdBody": ("Down Hold Body Inactive (doubleres).png", 128),
    "holdBodyActive": ("Down Hold Body Active (doubleres).png", 128),
    "holdTop": ("Down Hold TopCap inactive (doubleres).png", 128),
    "holdTopActive": ("Down Hold TopCap active (doubleres).png", 128),
    "holdCap": ("Down Hold BottomCap inactive (doubleres).png", 128),
    "holdCapActive": ("Down Hold BottomCap active (doubleres).png", 128),
    "rollBody": ("Down Roll Body Inactive (doubleres).png", 128),
    "rollBodyActive": ("Down Roll Body active (doubleres).png", 128),
    "rollTop": ("Down Roll TopCap Inactive (doubleres).png", 128),
    "rollTopActive": ("Down Roll TopCap Active (doubleres).png", 128),
    "rollCap": ("Down Roll BottomCap Inactive (doubleres).png", 128),
    "rollCapActive": ("Down Roll BottomCap Active (doubleres).png", 128),
    "flashMarvelous": ("Down Tap Explosion Dim Marvelous.png", 64),
    "flashPerfect": ("Down Tap Explosion Dim Perfect.png", 64),
    "flashGreat": ("Down Tap Explosion Dim Great.png", 64),
    "flashGood": ("Down Tap Explosion Dim Good.png", 64),
    "flashBoo": ("Down Tap Explosion Dim Boo.png", 64),
    "flashHold": ("down hold explosion.png", 64),
}

MESH_FILES = [
    "_down tap note meshes.txt",
    "textures/Tap Note parts (mipmaps).png",
    "_mine meshes.txt",
    "_mine tex.png",
]


def fetch(name: str) -> Path:
    path = CACHE / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://raw.githubusercontent.com/{UPSTREAM}/{COMMIT}/{SKIN}/{urllib.parse.quote(name)}"
        with urllib.request.urlopen(url) as response:
            path.write_bytes(response.read())
    return path


def load_texture(path: Path) -> np.ndarray:
    rgba = np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32) / 255.0
    rgba[..., :3] *= rgba[..., 3:4]
    return rgba


def sample(texture: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Bilinear, wrapping, premultiplied - the texture repeats because the scroll relies on it."""
    height, width = texture.shape[:2]
    x = u * width - 0.5
    y = v * height - 0.5
    x0, y0 = np.floor(x), np.floor(y)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    x0, y0 = x0.astype(int), y0.astype(int)
    xa, xb = x0 % width, (x0 + 1) % width
    ya, yb = y0 % height, (y0 + 1) % height
    top = texture[ya, xa] * (1 - fx) + texture[ya, xb] * fx
    bottom = texture[yb, xa] * (1 - fx) + texture[yb, xb] * fx
    return top * (1 - fy) + bottom * fy


def render(meshes: list[Mesh], texture: np.ndarray, shift: dict[str, tuple[float, float]]) -> Image.Image:
    """Orthographic, head-on, z-buffered. Larger z faces the viewer, as MilkShape exports it."""
    size = CELL_PIXELS * SUPERSAMPLE
    colour = np.zeros((size, size, 4), dtype=np.float32)
    depth = np.full((size, size), -np.inf, dtype=np.float32)

    for mesh in meshes:
        du, dv = shift.get(mesh.name, (0.0, 0.0))
        points = np.array(mesh.positions, dtype=np.float64)
        sx = (points[:, 0] / CELL_UNITS + 0.5) * size
        sy = (0.5 - points[:, 1] / CELL_UNITS) * size
        uvs = np.array(mesh.uvs, dtype=np.float64) + (du, dv)

        for a, b, c in mesh.triangles:
            xs, ys = sx[[a, b, c]], sy[[a, b, c]]
            area = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0])
            if abs(area) < 1e-9:
                continue

            left, right = max(int(np.floor(xs.min())), 0), min(int(np.ceil(xs.max())), size - 1)
            top, bottom = max(int(np.floor(ys.min())), 0), min(int(np.ceil(ys.max())), size - 1)
            if left > right or top > bottom:
                continue

            px, py = np.meshgrid(np.arange(left, right + 1) + 0.5, np.arange(top, bottom + 1) + 0.5)
            w0 = ((xs[1] - px) * (ys[2] - py) - (xs[2] - px) * (ys[1] - py)) / area
            w1 = ((xs[2] - px) * (ys[0] - py) - (xs[0] - px) * (ys[2] - py)) / area
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue

            w0, w1, w2 = w0[inside], w1[inside], w2[inside]
            z = w0 * points[a, 2] + w1 * points[b, 2] + w2 * points[c, 2]
            u = w0 * uvs[a, 0] + w1 * uvs[b, 0] + w2 * uvs[c, 0]
            v = w0 * uvs[a, 1] + w1 * uvs[b, 1] + w2 * uvs[c, 1]
            texel = sample(texture, u, v)

            rows, cols = py[inside].astype(int), px[inside].astype(int)
            front = (z >= depth[rows, cols]) & (texel[:, 3] > 0)
            rows, cols, texel, z = rows[front], cols[front], texel[front], z[front]
            colour[rows, cols] = texel + colour[rows, cols] * (1 - texel[:, 3:4])
            depth[rows, cols] = z

    colour = colour.reshape(CELL_PIXELS, SUPERSAMPLE, CELL_PIXELS, SUPERSAMPLE, 4).mean(axis=(1, 3))
    return to_image(colour)


def to_image(premultiplied: np.ndarray) -> Image.Image:
    alpha = premultiplied[..., 3:4]
    straight = np.where(alpha > 0, premultiplied / np.maximum(alpha, 1e-6), 0)
    straight[..., 3:4] = alpha
    return Image.fromarray(np.clip(straight * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA")


class Atlas:
    """Shelf packing. Every rect is padded by repeating its own edge so filtering never reaches a neighbour."""

    def __init__(self) -> None:
        self.placed: list[tuple[Image.Image, int, int]] = []
        self.x = self.y = self.shelf = 0

    def add(self, image: Image.Image) -> list[int]:
        width, height = image.width + 2 * PAD, image.height + 2 * PAD
        if self.x + width > ATLAS_WIDTH:
            self.x, self.y, self.shelf = 0, self.y + self.shelf, 0
        self.placed.append((image, self.x + PAD, self.y + PAD))
        rect = [self.x + PAD, self.y + PAD, image.width, image.height]
        self.x += width
        self.shelf = max(self.shelf, height)
        return rect

    def save(self, path: Path) -> list[int]:
        height = self.y + self.shelf
        sheet = Image.new("RGBA", (ATLAS_WIDTH, height))
        for image, x, y in self.placed:
            padded = np.pad(np.asarray(image), ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")
            sheet.paste(Image.fromarray(padded), (x - PAD, y - PAD))
        sheet.save(path, optimize=True)
        return [ATLAS_WIDTH, height]


def main() -> None:
    for name in MESH_FILES + [file for file, _ in SPRITES.values()]:
        fetch(name)

    tap_meshes = read_meshes(CACHE / "_down tap note meshes.txt")
    tap_texture = load_texture(CACHE / "textures/Tap Note parts (mipmaps).png")
    mine_meshes = read_meshes(CACHE / "_mine meshes.txt")
    mine_texture = load_texture(CACHE / "_mine tex.png")

    atlas = Atlas()
    manifest: dict = {"texture": "atlas.png", "cellPixels": CELL_PIXELS}

    taps = {}
    for quant, label in QUANTS.items():
        frames = []
        for frame in range(TAP_FRAMES):
            # TexVelocityY=-1 over a one-second texture loop, stretched across the animation.
            shift = {TAP_COLOUR_MESH: (QUANT_OFFSET_U[quant], -frame / TAP_FRAMES)}
            frames.append(atlas.add(render(tap_meshes, tap_texture, shift)))
        taps[str(quant)] = frames
        print(f"tap {label}: {TAP_FRAMES} frames")
    manifest["tap"] = {"animationBeats": TAP_BEATS, "frames": taps}

    mines = []
    for frame in range(MINE_FRAMES):
        shift = {MINE_PULSE_MESH: (frame / MINE_FRAMES, 0.0)}
        mines.append(atlas.add(render(mine_meshes, mine_texture, shift)))
    manifest["mine"] = {"animationBeats": MINE_BEATS, "frames": mines}
    print(f"mine: {MINE_FRAMES} frames")

    sprites = {}
    for key, (file, pixels_per_cell) in SPRITES.items():
        image = Image.open(CACHE / file).convert("RGBA")
        sprites[key] = {
            "rect": atlas.add(image),
            "cells": [image.width / pixels_per_cell, image.height / pixels_per_cell],
        }
    manifest["sprites"] = sprites
    print(f"sprites: {len(sprites)}")

    OUT.mkdir(parents=True, exist_ok=True)
    manifest["size"] = atlas.save(OUT / "atlas.png")
    (OUT / "noteskin.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"atlas {manifest['size'][0]}x{manifest['size'][1]} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
