"""Reads the MilkShape 3D ASCII meshes StepMania noteskins ship their models in."""

from dataclasses import dataclass
from pathlib import Path


@dataclass
class Mesh:
    name: str
    positions: list[tuple[float, float, float]]
    uvs: list[tuple[float, float]]
    triangles: list[tuple[int, int, int]]


def read_meshes(path: Path) -> list[Mesh]:
    lines = [line.strip() for line in path.read_text().splitlines()]
    at = next(i for i, line in enumerate(lines) if line.startswith("Meshes:"))
    count = int(lines[at].split(":")[1])
    at += 1

    meshes = []
    for _ in range(count):
        name = lines[at].split('"')[1]
        at += 1

        vertex_count = int(lines[at])
        positions, uvs = [], []
        for line in lines[at + 1 : at + 1 + vertex_count]:
            fields = line.split()
            positions.append((float(fields[1]), float(fields[2]), float(fields[3])))
            uvs.append((float(fields[4]), float(fields[5])))
        at += 1 + vertex_count

        normal_count = int(lines[at])
        at += 1 + normal_count

        triangle_count = int(lines[at])
        triangles = []
        for line in lines[at + 1 : at + 1 + triangle_count]:
            fields = line.split()
            triangles.append((int(fields[1]), int(fields[2]), int(fields[3])))
        at += 1 + triangle_count

        meshes.append(Mesh(name, positions, uvs, triangles))

    return meshes
