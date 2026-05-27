# Chisel Share — API Reference

Base URL: `https://chisel.tekkie.com.au`

---

## Mod Quick-Reference

These are the endpoints most relevant for a Vintage Story mod integrating with the Chisel Share database.

| Action | Method | Endpoint |
|---|---|---|
| Browse schematics | `GET` | `/api/schematics?page=1&sort=newest` |
| Search schematics | `GET` | `/api/schematics?q=house&sort=most_liked` |
| Get schematic + XML | `GET` | `/api/schematics/{id}` |
| Download schematic XML | `GET` | `/api/schematics/{id}/download` |
| Upload schematic | `POST` | `/api/schematics` |
| Browse collections | `GET` | `/api/collections?page=1&sort=newest` |
| Search collections | `GET` | `/api/collections?q=castle` |
| Get collection + parts | `GET` | `/api/collections/{id}` |
| Download collection ZIP | `GET` | `/api/collections/{id}/download` |
| Upload collection | `POST` | `/api/collections` |
| Set / import token | `POST` | `/api/token` |

### Identity (uploader_token)

All write operations use a UUID v4 cookie called `uploader_token`. The mod should:

1. On first run, call `POST /api/token` (no body) to generate a fresh token.
2. Persist the returned token locally and send it as a cookie (`Cookie: uploader_token=<uuid>`) on every request.
3. To restore ownership on a new install, call `POST /api/token` with body `{ "token": "<saved-uuid>" }`.

> **No authentication is required for read/browse/download operations.**

### Rate Limits

| Operation | Limit |
|---|---|
| Upload schematic or collection | 5 per 10 minutes per IP (shared bucket) |
| Download schematic XML | 30 per minute per IP |
| Report collection | 10 per 10 minutes per IP |

When rate-limited, the response is `429` with header `Retry-After: <seconds>`.

---

## Schematics

### `GET /api/schematics`

Browse standalone schematics (paginated). Schematics that are part of a collection do not appear here.

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (1-based) |
| `sort` | `newest` \| `most_liked` | `newest` | Sort order |
| `q` | string | — | Optional search query (matches display name, internal name, description) |

**Response `200`**

```json
{
  "schematics": [
    {
      "id": "uuid",
      "name": "string",
      "display_name": "string",
      "description": "string | null",
      "filename": "string",
      "blockcodes": ["string"],
      "cuboid_count": 0,
      "uploaded_at": 1700000000,
      "uploader_token": "uuid | null",
      "download_count": 0,
      "collection_id": null,
      "collection_order": 0,
      "like_count": 0
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 1
}
```

---

### `POST /api/schematics`

Upload a new standalone schematic.

**Request** — `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File | Yes | QP Chisel `.xml` schematic, max 2 MB. Must contain `<PantographData` tag. |
| `display_name` | string | Yes | User-facing name, max 120 chars |
| `description` | string | No | Max 1000 chars |
| `thumbnail` | File | No | PNG, max 512 KB. Server generates one automatically if omitted. |

**Response `201`** — Created schematic record (same shape as one item in `GET /api/schematics`, without `like_count`). Sets `uploader_token` cookie.

**Errors**

| Status | Body |
|---|---|
| `400` | `{ "error": "No file provided" }` |
| `400` | `{ "error": "File too large (max 2 MB)" }` |
| `400` | `{ "error": "Not a valid QP Chisel schematic file" }` |
| `400` | `{ "error": "No blockcodes found in schematic" }` |
| `400` | `{ "error": "Display name is required" }` |
| `429` | `{ "error": "Too many uploads. Please wait before uploading again." }` |

---

### `GET /api/schematics/{id}`

Get a single schematic, including its full XML content inline.

**Path parameters** — `id`: UUID

**Response `200`**

```json
{
  "id": "uuid",
  "name": "string",
  "display_name": "string",
  "description": "string | null",
  "filename": "string",
  "blockcodes": ["string"],
  "cuboid_count": 0,
  "uploaded_at": 1700000000,
  "uploader_token": "uuid | null",
  "download_count": 0,
  "collection_id": "uuid | null",
  "collection_order": 0,
  "like_count": 0,
  "xmlContent": "<PantographData>...</PantographData>"
}
```

**Errors** — `404` `{ "error": "Not found" }` or `{ "error": "Schematic file missing from disk" }`

---

### `PATCH /api/schematics/{id}`

Update a schematic's display name or description. Requires ownership.

**Auth** — `uploader_token` cookie must match the schematic's owner, or equal the `ADMIN_TOKEN` env value.

**Request** — `application/json`

```json
{ "display_name": "string", "description": "string | null" }
```

**Response `200`** — Updated schematic record.

**Errors** — `400` invalid JSON / missing name · `403` forbidden · `404` not found

---

### `DELETE /api/schematics/{id}`

Delete a schematic. Requires ownership.

**Auth** — `uploader_token` cookie must match or be admin.

**Response `204`** — No content.

**Errors** — `403` forbidden · `404` not found

---

### `GET /api/schematics/{id}/download`

Download the raw XML file. Increments `download_count`.

**Response `200`** — Raw XML with headers:
- `Content-Type: text/xml; charset=utf-8`
- `Content-Disposition: attachment; filename="<name>.xml"`

**Errors** — `404` plain text · `429` plain text (rate-limited, 30/min per IP)

---

### `GET /api/schematics/{id}/like`

Get the like status for the current user and total like count.

**Auth** — `uploader_token` cookie (optional — omit to get count without personal status).

**Response `200`**

```json
{ "liked": false, "count": 42 }
```

**Errors** — `404` not found

---

### `POST /api/schematics/{id}/like`

Toggle like on a schematic. Creates `uploader_token` cookie if absent.

**Response `200`**

```json
{ "liked": true, "count": 43 }
```

`liked` is `true` if the schematic is now liked, `false` if it was unliked.

**Errors** — `404` not found

---

### `GET /api/schematics/{id}/thumb`

Get the PNG thumbnail image (256×192).

**Response `200`** — PNG image. `Cache-Control: public, max-age=31536000, immutable`

**Errors** — `404` empty response

---

### `POST /api/schematics/{id}/thumb` _(admin only)_

Replace a schematic's thumbnail.

**Auth** — `uploader_token` cookie must equal `ADMIN_TOKEN` env value.

**Request** — `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `thumbnail` | File | Yes | PNG, max 512 KB |

**Response `200`** — `{ "ok": true }`

**Errors** — `400` missing/invalid file · `403` forbidden · `404` not found

---

## Collections

### `GET /api/collections`

Browse collections (paginated).

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (1-based) |
| `sort` | `newest` \| `most_liked` | `newest` | Sort order |
| `q` | string | — | Optional search query (matches name, description) |

**Response `200`**

```json
{
  "collections": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string | null",
      "uploader_token": "uuid | null",
      "created_at": 1700000000,
      "like_count": 0,
      "thumbnail_image_id": "uuid | null",
      "schematic_count": 3
    }
  ],
  "total": 0,
  "page": 1,
  "totalPages": 1
}
```

`schematic_count` — number of schematic parts in the collection.  
`thumbnail_image_id` — if non-null, use `GET /api/collections/{id}/images/{thumbnail_image_id}` for the cover image; otherwise fall back to the thumbnail of the first schematic part.

---

### `POST /api/collections`

Upload a new collection with one or more schematic parts and optional cover images.

**Request** — `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | Max 120 chars |
| `description` | string | No | Max 1000 chars |
| `count` | string (number) | Yes | Number of schematic files (1–20) |
| `file_0` … `file_{count-1}` | File | Yes | QP Chisel `.xml`, max 2 MB each |
| `display_name_0` … | string | No | Per-part name, max 120 chars |
| `description_0` … | string | No | Per-part description, max 1000 chars |
| `thumbnail_0` … | File | No | Per-part PNG thumbnail, max 512 KB |
| `image_count` | string (number) | No | Number of collection cover images (0–5) |
| `image_0` … `image_{image_count-1}` | File | No | PNG or JPEG, max 5 MB each |
| `thumbnail_image_index` | string (number) | No | Which `image_N` to use as the collection cover thumbnail |

**Response `201`**

```json
{ "id": "uuid", "name": "string", "schematicIds": ["uuid"] }
```

Sets `uploader_token` cookie.

**Errors** — `400` validation errors (similar to schematic upload) · `429` rate-limited

---

### `GET /api/collections/{id}`

Get a collection with all its member schematics and images.

**Path parameters** — `id`: UUID

**Response `200`**

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "uploader_token": "uuid | null",
  "created_at": 1700000000,
  "like_count": 0,
  "thumbnail_image_id": "uuid | null",
  "images": [
    {
      "id": "uuid",
      "collection_id": "uuid",
      "display_order": 0,
      "ext": "png",
      "created_at": 1700000000
    }
  ],
  "schematics": [
    {
      "id": "uuid",
      "name": "string",
      "display_name": "string",
      "description": "string | null",
      "filename": "string",
      "blockcodes": ["string"],
      "cuboid_count": 0,
      "uploaded_at": 1700000000,
      "uploader_token": "uuid | null",
      "download_count": 0,
      "collection_id": "uuid",
      "collection_order": 0,
      "like_count": 0
    }
  ]
}
```

Schematics are ordered by `collection_order` ascending.

**Errors** — `404` not found

---

### `PATCH /api/collections/{id}`

Edit a collection's metadata, reorder/add/remove parts, and manage cover images.

**Auth** — `uploader_token` cookie must match owner or be admin.

**Request** — `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required, max 120 chars |
| `description` | string | Optional, max 1000 chars |
| `order` | JSON string | Array of existing schematic UUIDs in desired order. Parts omitted are deleted. |
| `meta_{id}_display_name` | string | Update display name for an existing part |
| `meta_{id}_description` | string | Update description for an existing part |
| `new_count` | string (number) | Number of new schematic files to add |
| `new_file_0` … | File | New schematic XMLs |
| `new_display_name_0` … | string | Names for new parts |
| `new_description_0` … | string | Descriptions for new parts |
| `new_thumbnail_0` … | File | PNG thumbnails for new parts, max 512 KB |
| `img_remove` | JSON string | Array of image UUIDs to delete |
| `img_order` | JSON string | Array of image UUIDs in desired display order |
| `img_new_count` | string (number) | Number of new cover images to add |
| `img_new_0` … | File | New cover images (PNG/JPEG, max 5 MB) |
| `thumbnail_image_id` | string | UUID of the image to use as collection cover |

**Response `200`** — Updated collection (same shape as `GET /api/collections/{id}`).

**Errors** — `400` validation · `403` forbidden · `404` not found

**Notes** — Max 20 total parts. Schematics not listed in `order` are permanently deleted.

---

### `DELETE /api/collections/{id}`

Delete a collection and all its member schematics.

**Auth** — `uploader_token` cookie must match owner or be admin.

**Response `204`** — No content.

**Errors** — `403` forbidden · `404` not found

---

### `GET /api/collections/{id}/download`

Download all member schematics as a ZIP archive.

**Response `200`** — ZIP file with headers:
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="<collection_name>.zip"`

Files inside the ZIP are named `Part_1_<name>.xml`, `Part_2_<name>.xml`, etc. (single-part collections omit the prefix).

**Errors** — `404` plain text

---

### `GET /api/collections/{id}/like`

Get like status and total count for a collection.

**Auth** — `uploader_token` cookie (optional).

**Response `200`**

```json
{ "liked": false, "count": 7 }
```

**Errors** — `404` not found

---

### `POST /api/collections/{id}/like`

Toggle like on a collection. Creates `uploader_token` cookie if absent.

**Response `200`**

```json
{ "liked": true, "count": 8 }
```

**Errors** — `404` not found

---

### `GET /api/collections/{id}/images/{imageId}`

Serve a collection cover image.

**Path parameters** — `id`: collection UUID · `imageId`: image UUID

**Response `200`** — PNG or JPEG image. `Cache-Control: public, max-age=31536000, immutable`

**Errors** — `404` empty response

---

### `POST /api/collections/{id}/report`

Report a collection for moderation.

**Auth** — `uploader_token` cookie (created if absent). Cannot report your own collection.

**Request** — `application/json`

```json
{ "reason": "offensive" }
```

`reason` values: `"offensive"` · `"spam"` · `"broken_textures"` (defaults to `"offensive"`)

**Response `201`** — `{ "ok": true }`

**Errors**

| Status | Body |
|---|---|
| `403` | `{ "error": "You cannot report your own collection" }` |
| `404` | `{ "error": "Not found" }` |
| `409` | `{ "error": "Already reported" }` |
| `429` | Rate-limited (10 per 10 minutes per IP) |

---

## Token

### `POST /api/token`

Create or restore an `uploader_token` identity cookie. Call once on first run; persist the returned token.

**Request** — `application/json` (optional body)

```json
{ "token": "existing-uuid-v4" }
```

Omit the body (or omit `token`) to generate a fresh UUID.

**Response `200`**

```json
{ "token": "uuid-v4" }
```

Sets `uploader_token` cookie (httpOnly, sameSite: lax, 1-year expiry).

**Errors** — `400` `{ "error": "Invalid token format" }` if provided token is not a valid UUID v4.

---

## Admin

### `GET /api/admin/reports` _(admin only)_

List collections that have been reported, sorted by report count.

**Auth** — `uploader_token` cookie must equal the `ADMIN_TOKEN` env value.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "name": "string",
    "report_count": 3,
    "last_reported_at": 1700000000
  }
]
```

**Errors** — `403` forbidden

---

## Assets

### `GET /api/textures/{...path}`

Serve a bundled texture PNG from the server's `/textures/` directory. Used by the in-browser schematic viewer.

**Path parameters** — Nested path segments, e.g. `/api/textures/clay/block/clay.png`

Path segment rules: alphanumeric, hyphens, and underscores only. Last segment must end with `.png`. Directory traversal is rejected.

**Response `200`** — PNG image. `Cache-Control: public, max-age=31536000, immutable`

**Errors** — `404` plain text (invalid path, traversal attempt, or file not found)

---

## Data Types

### Schematic object

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Unique identifier |
| `name` | `string` | Internal name parsed from XML |
| `display_name` | `string \| null` | User-provided display name |
| `description` | `string \| null` | Optional description |
| `filename` | `string` | Storage filename (`<uuid>.xml`) |
| `blockcodes` | `string[]` | List of Vintage Story block codes used |
| `cuboid_count` | `number` | Total number of cuboids in the schematic |
| `uploaded_at` | `number` | Unix timestamp (seconds) |
| `uploader_token` | `string \| null` | Owner identity UUID |
| `download_count` | `number` | Times the XML has been downloaded |
| `collection_id` | `string \| null` | UUID of parent collection, or `null` for standalone |
| `collection_order` | `number` | Position within a collection (0-based) |
| `like_count` | `number` | Total likes |
| `xmlContent` | `string` | Full XML content — only present on `GET /api/schematics/{id}` |

### Collection object (list)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Unique identifier |
| `name` | `string` | Collection name |
| `description` | `string \| null` | Optional description |
| `uploader_token` | `string \| null` | Owner identity UUID |
| `created_at` | `number` | Unix timestamp (seconds) |
| `like_count` | `number` | Total likes |
| `thumbnail_image_id` | `string \| null` | UUID of the cover image (see `/api/collections/{id}/images/{imageId}`) |
| `schematic_count` | `number` | Number of schematic parts in this collection |
