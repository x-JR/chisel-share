# Chisel Share

A self-hosted community gallery for [**QP Chisel**](https://mods.vintagestory.at/chiseltools) and [**Chisel Wiz**](https://mods.vintagestory.at/chiselwiz) schematics. Upload `.xml` or `.json` schematic files and view them as interactive 3D renders in the browser.

**Live site:** https://chisel.tekkie.com.au

## Features

- Upload and browse QP Chisel (`.xml`) and ChizWiz (`.json`) schematics
- Interactive 3D viewer (Three.js, OrbitControls — rotate, zoom, pan)
- Actual Vintage Story block textures
- Material swatches in gallery cards
- Download schematics as QP Chisel XML or ChizWiz JSON
- **Collections** — group related schematics together with cover images
- **Likes** — like/unlike individual schematics and collections
- **Author names** — optional author attribution on uploads
- **ChizWiz Merge Tool** — import an existing ChizWiz catalogue, browse the gallery, and export a merged catalogue
- **How To page** — in-app guides for saving and importing schematics in both QP Chisel and ChizWiz
- Gallery search, sort (newest / most liked), per-page selector, and schematics/collections filter
- Cookie-based ownership token — edit and delete your own uploads without an account
- Admin panel for reviewing reported content (requires `ADMIN_TOKEN`)
- Rate-limited uploads (20 per 10 minutes per IP)
- Fully self-hosted, Dockerized

## Quick Start (Docker)

**Prerequisites:** Docker, Docker Compose, and an external MySQL 8 (or MariaDB 10.3+) database.

```bash
# 1. Clone / copy this repo
git clone <repo-url> chisel-portfolio
cd chisel-portfolio

# 2. Create data directory
mkdir -p data

# 3. Configure environment (see Configuration section below)
cp .env.example .env   # or set variables in your shell

# 4. Build and start
docker compose up --build
```

Open **http://localhost:3000**.

The app creates all required tables automatically on first start. A reference `schema.sql` is included if you prefer to initialise the database manually.

## Development (without Docker)

**Prerequisites:** Node.js 20+, npm, and an accessible MySQL 8 database.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

## Configuration

Set these in your environment or in a `.env` file (for local dev):

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://chiselshare.com` | Public URL of your deployment — used for sitemaps, canonical URLs, and Open Graph tags. **Must be set at Docker build time** (build arg). |
| `DB_HOST` | — | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | — | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | — | MySQL database name |
| `DATA_DIR` | `./data` | Root directory for uploaded schematics, thumbnails, and collection images |
| `ADMIN_TOKEN` | — | When set, a user whose `uploader_token` cookie matches this value gains edit/delete rights on all content and access to `/admin/reports` |
| `PORT` | `3000` | HTTP port |

> **Note:** `NEXT_PUBLIC_SITE_URL` is a Next.js public variable baked into the client bundle at build time. When building with Docker, pass it as a build argument:
> ```bash
> docker compose build --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com
> ```
> Or set `NEXT_PUBLIC_SITE_URL` in your shell / `.env` before running `docker compose up --build`.

## Project Structure

```
app/                      Next.js App Router pages & API routes
  api/
    schematics/           GET list, POST upload
    schematics/[id]/      GET, DELETE, PATCH by id
      download/           GET download (QP Chisel XML or ChizWiz JSON via ?format=chiselwiz)
      like/               GET status, POST toggle like
      thumb/              GET regenerate thumbnail
      voxels/             GET parsed voxel data (JSON)
    collections/          GET list, POST create collection
    collections/[id]/     GET, DELETE, PATCH
      download/           GET download all parts as ZIP
      images/[imageId]    GET serve custom collection image
      like/               GET status, POST toggle like
      report/             POST submit content report
    textures/             Serve PNG textures with path-traversal protection
    token/                POST set or regenerate uploader_token cookie
    admin/reports/        GET list reported collections (admin only)
  view/[id]/              3D viewer detail page for individual schematics
  view/collection/[id]/   Collection detail page
  upload/                 Single schematic upload form
  upload/collection/      Collection upload form
  upload/chiselwiz/       ChizWiz Merge Tool
  how-to/                 Usage guides (QP Chisel + ChizWiz tabs)
  admin/reports/          Admin: review reported collections
  page.tsx                Gallery homepage
components/
  SchematicViewer         Three.js 3D viewer (client-only)
  SchematicCard           Gallery card for individual schematics
  CollectionCard          Gallery card for collections
  UploadForm              Drag-and-drop upload form (.xml and .json)
  UploadCollectionForm    Multi-part collection upload form
  EditSchematicClient     In-page edit panel (name, description, author)
  EditCollectionClient    In-page collection editor (reorder, add/remove parts, images)
  ChiselWizMergeTool      Client-side ChizWiz catalogue merge tool
  DeleteButton            Delete schematic with confirmation
  DeleteCollectionButton  Delete collection with confirmation
  LikeButton              Like/unlike toggle
  ReportButton            Report a collection for review
  TokenManager            View/set your uploader_token
  HowToTabs               Tabbed how-to guides
lib/
  db.ts                   MySQL via mysql2/promise; auto-creates and migrates schema on startup
  schematic-parser.ts     Server-side XML → metadata extractor
  chiselwiz-server.ts     Server-side ChizWiz JSON parse, convert to/from XML
  voxel-decoder.ts        Browser-side voxel decoder (XML + ChizWiz, gzip, greedy mesh)
  texture-resolver.ts     Blockcode → texture URL mapping
  thumbnail.ts            Isometric canvas thumbnail generator (256×192 PNG)
  capture-thumbnail-client.ts  Client-side Three.js thumbnail capture
  rate-limit.ts           In-memory sliding-window rate limiter
  logger.ts               Structured action logging
textures/                 Vintage Story block textures (bundled)
data/                     (git-ignored) Uploaded files, thumbnails, collection images
schema.sql                Reference schema for manual DB initialisation
```

## Database

The app uses **MySQL 8** (or MariaDB 10.3+). Tables are created automatically on first start. Migrations (new columns) are also applied automatically via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, so upgrading an existing install requires no manual SQL.

Tables: `schematics`, `collections`, `likes`, `collection_likes`, `collection_images`, `collection_reports`.

## Identity & Ownership

A UUID `uploader_token` cookie is set in the browser on first upload or like action. This token is used to:
- Grant edit/delete rights on your own schematics and collections
- Track likes (one like per token per item)
- Identify the admin when `uploader_token` matches `ADMIN_TOKEN`

The token can be viewed, copied, or replaced via the token manager in the top nav (useful for moving ownership between browsers or devices).

## ChizWiz Format Support

Both QP Chisel (`.xml` / PantographData) and ChizWiz (`.json`) formats are accepted on upload. ChizWiz files are converted to PantographData XML at upload time for storage. Downloads are available in either format.

The **ChizWiz Merge Tool** (`/upload/chiselwiz`) lets you:
1. Import an existing ChizWiz catalogue
2. Browse the gallery and add community schematics
3. Upload designs from your catalogue as standalone schematics or a collection
4. Export a merged `.json` catalogue — entirely client-side

## Schematic Format (PantographData XML)

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
