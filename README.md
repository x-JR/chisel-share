# Chisel Portfolio

A self-hosted web gallery for sharing **Vintage Story QP Chisel** (Pantograph mod) schematics. Upload `.xml` schematic files and view them as interactive 3D renders in the browser.

## Features

- Upload and browse QP Chisel schematics
- Interactive 3D viewer (Three.js, OrbitControls — rotate, zoom, pan)
- Actual Vintage Story block textures
- Material swatches in gallery cards
- Download schematics back to disk
- Fully self-hosted, Dockerized

## Quick Start (Docker)

```bash
# 1. Clone / copy this repo
git clone <repo-url> chisel-portfolio
cd chisel-portfolio

# 2. Create data directory
mkdir -p data/schematics

# 3. Start
docker compose up --build
```

Open **http://localhost:3000**.

## Development (without Docker)

**Prerequisites:** Node.js 20+, npm

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|---|---|---|
| `TEXTURE_PATH` | `./textures/block` | Path to VS block textures (relative or absolute) |
| `DATA_DIR` | `./data` | Where uploaded schematics and the SQLite DB are stored |
| `PORT` | `3000` | HTTP port |

## Project Structure

```
app/               Next.js App Router pages & API routes
  api/
    schematics/    GET list, POST upload, GET/DELETE by id, GET download
    textures/      Serve PNG textures with path-traversal protection
  view/[id]/       3D viewer detail page
  upload/          Upload form page
  page.tsx         Gallery homepage
components/
  SchematicViewer  Three.js 3D viewer (client-only)
  SchematicCard    Gallery card
  UploadForm       Drag-and-drop upload form
  DeleteButton     Client-side delete with confirmation
lib/
  db.ts            SQLite via better-sqlite3
  schematic-parser Server-side XML → metadata extractor
  voxel-decoder    Browser-side protobuf varint decoder + XML parser
  texture-resolver Blockcode → texture URL mapping
textures/          Vintage Story block textures (bundled)
data/              (git-ignored) SQLite DB + uploaded XML files
```

## Schematic Format

PantographData XML files contain:
- `<name>` — schematic display name
- `<blockcodes>` — list of VS block codes, one per material slot
- `<voxeldata>` — base64-encoded protobuf repeated uint32 array

Each packed uint32 encodes a `VoxelCuboid`:
```
bits  0– 3  x1   bits 12–15  x2
bits  4– 7  y1   bits 16–19  y2
bits  8–11  z1   bits 20–23  z2
bits 24–27  material index
```

The coordinate space is 0–15 on each axis (16×16×16 voxels = 1 full block).
