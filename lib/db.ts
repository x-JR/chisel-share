import mysql, { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let _pool: mysql.Pool | null = null;
let _schemaReady: Promise<void> | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const database = process.env.DB_NAME;

    if (!host || !user || !database) {
      throw new Error(
        'DB_HOST, DB_USER, and DB_NAME environment variables must be set'
      );
    }

    _pool = mysql.createPool({
      host,
      port: parseInt(process.env.DB_PORT ?? '3306', 10),
      user,
      password: process.env.DB_PASSWORD ?? '',
      database,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });

    _schemaReady = (async (pool: mysql.Pool) => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS schematics (
          id              VARCHAR(36)  NOT NULL,
          name            TEXT         NOT NULL,
          display_name    TEXT         DEFAULT NULL,
          description     TEXT         DEFAULT NULL,
          author_name     TEXT         DEFAULT NULL,
          filename        VARCHAR(255) NOT NULL,
          blockcodes      MEDIUMTEXT   NOT NULL,
          cuboid_count    INT          NOT NULL DEFAULT 0,
          uploaded_at     INT          NOT NULL,
          uploader_token  VARCHAR(36)  DEFAULT NULL,
          download_count  INT          NOT NULL DEFAULT 0,
          collection_id   VARCHAR(36)  DEFAULT NULL,
          collection_order INT         NOT NULL DEFAULT 0,
          PRIMARY KEY (id),
          INDEX idx_schematics_collection (collection_id),
          INDEX idx_schematics_uploaded (uploaded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // Migrations for existing installs
      await pool.execute(`
        ALTER TABLE schematics
          ADD COLUMN IF NOT EXISTS download_count   INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS collection_id    VARCHAR(36) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS collection_order INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS author_name      TEXT DEFAULT NULL
      `).catch(() => { /* already present */ });
      await pool.execute(
        'CREATE INDEX IF NOT EXISTS idx_schematics_collection ON schematics (collection_id)'
      ).catch(() => { /* already present */ });
      await pool.execute(
        'CREATE INDEX IF NOT EXISTS idx_schematics_uploaded ON schematics (uploaded_at)'
      ).catch(() => { /* already present */ });
      await pool.execute(
        'CREATE INDEX IF NOT EXISTS idx_collections_created ON collections (created_at)'
      ).catch(() => { /* already present */ });
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS collections (
          id             VARCHAR(36)  NOT NULL,
          name           TEXT         NOT NULL,
          description    TEXT         DEFAULT NULL,
          author_name    TEXT         DEFAULT NULL,
          uploader_token VARCHAR(36)  DEFAULT NULL,
          created_at     INT          NOT NULL,
          PRIMARY KEY (id),
          INDEX idx_collections_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS likes (
          schematic_id  VARCHAR(36)  NOT NULL,
          voter_token   VARCHAR(36)  NOT NULL,
          liked_at      INT          NOT NULL,
          PRIMARY KEY (schematic_id, voter_token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS collection_likes (
          collection_id  VARCHAR(36)  NOT NULL,
          voter_token    VARCHAR(36)  NOT NULL,
          liked_at       INT          NOT NULL,
          PRIMARY KEY (collection_id, voter_token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS collection_images (
          id            VARCHAR(36)  NOT NULL,
          collection_id VARCHAR(36)  NOT NULL,
          display_order INT          NOT NULL DEFAULT 0,
          ext           VARCHAR(4)   NOT NULL,
          created_at    INT          NOT NULL,
          PRIMARY KEY (id),
          INDEX idx_ci_collection (collection_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        ALTER TABLE collections
          ADD COLUMN IF NOT EXISTS thumbnail_image_id VARCHAR(36) NULL,
          ADD COLUMN IF NOT EXISTS author_name        TEXT DEFAULT NULL
      `).catch(() => { /* already present */ });
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS collection_reports (
          id             INT          NOT NULL AUTO_INCREMENT,
          collection_id  VARCHAR(36)  NOT NULL,
          reporter_token VARCHAR(36)  NOT NULL,
          reason         VARCHAR(50)  NOT NULL DEFAULT 'other',
          created_at     INT          NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY unique_report (collection_id, reporter_token),
          INDEX idx_cr_collection (collection_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS logs (
          id            INT          NOT NULL AUTO_INCREMENT,
          timestamp     INT          NOT NULL,
          ip            VARCHAR(45)  NOT NULL,
          user_agent    TEXT         DEFAULT NULL,
          action        VARCHAR(64)  NOT NULL,
          resource_type VARCHAR(32)  DEFAULT NULL,
          resource_id   VARCHAR(36)  DEFAULT NULL,
          voter_token   VARCHAR(36)  DEFAULT NULL,
          status        VARCHAR(32)  NOT NULL DEFAULT 'success',
          details       TEXT         DEFAULT NULL,
          PRIMARY KEY (id),
          INDEX idx_logs_timestamp (timestamp),
          INDEX idx_logs_ip (ip),
          INDEX idx_logs_action (action)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })(_pool);
  }
  return _pool;
}

async function db(): Promise<mysql.Pool> {
  const pool = getPool();
  await _schemaReady;
  return pool;
}

export interface SchematicRecord {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  filename: string;
  blockcodes: string; // JSON-encoded string[]
  cuboid_count: number;
  uploaded_at: number; // Unix timestamp (seconds)
  uploader_token: string | null;
  download_count: number;
  collection_id: string | null;
  collection_order: number;
  author_name?: string | null;
  like_count?: number; // populated by queries that include a subquery
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string | null;
  uploader_token: string | null;
  created_at: number; // Unix timestamp (seconds)
  author_name?: string | null;
  like_count?: number; // populated by queries that include a subquery
  thumbnail_image_id?: string | null;
  schematic_count?: number; // populated by list queries
}

export interface CollectionImageRecord {
  id: string;
  collection_id: string;
  display_order: number;
  ext: string; // 'jpg' | 'png'
  created_at: number;
}

// ─── Schematics ──────────────────────────────────────────────────────────────

/** Lists standalone schematics (not part of a collection). */
export async function listSchematics(
  limit = 24,
  offset = 0,
  sort: 'newest' | 'most_liked' = 'newest'
): Promise<SchematicRecord[]> {
  const pool = await db();
  const orderBy = sort === 'most_liked'
    ? 'like_count DESC, s.uploaded_at DESC'
    : 's.uploaded_at DESC';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM likes WHERE schematic_id = s.id) AS like_count
     FROM schematics s
     WHERE s.collection_id IS NULL
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows as SchematicRecord[];
}

export async function countSchematics(): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM schematics WHERE collection_id IS NULL'
  );
  return (rows[0] as { count: number }).count;
}

export async function countAllSchematics(): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM schematics'
  );
  return (rows[0] as { count: number }).count;
}

export async function searchSchematics(
  query: string,
  limit = 24,
  offset = 0,
  sort: 'newest' | 'most_liked' = 'newest'
): Promise<SchematicRecord[]> {
  const pool = await db();
  const like = `%${query}%`;
  const orderBy = sort === 'most_liked'
    ? 'like_count DESC, s.uploaded_at DESC'
    : 's.uploaded_at DESC';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM likes WHERE schematic_id = s.id) AS like_count
     FROM schematics s
     WHERE s.collection_id IS NULL
       AND (s.display_name LIKE ? OR s.name LIKE ? OR s.description LIKE ?)
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [like, like, like, limit, offset]
  );
  return rows as SchematicRecord[];
}

export async function countSearchResults(query: string): Promise<number> {
  const pool = await db();
  const like = `%${query}%`;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM schematics
     WHERE collection_id IS NULL
       AND (display_name LIKE ? OR name LIKE ? OR description LIKE ?)`,
    [like, like, like]
  );
  return (rows[0] as { count: number }).count;
}

export async function getAllSchematicIdsForSitemap(): Promise<{ id: string; uploaded_at: number }[]> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, uploaded_at FROM schematics WHERE collection_id IS NULL ORDER BY uploaded_at DESC'
  );
  return rows as { id: string; uploaded_at: number }[];
}

export async function getAllCollectionIdsForSitemap(): Promise<{ id: string; created_at: number }[]> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, created_at FROM collections ORDER BY created_at DESC'
  );
  return rows as { id: string; created_at: number }[];
}

export async function getSchematic(id: string): Promise<SchematicRecord | undefined> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM likes WHERE schematic_id = s.id) AS like_count
     FROM schematics s WHERE s.id = ?`,
    [id]
  );
  return rows[0] as SchematicRecord | undefined;
}

export async function insertSchematic(record: SchematicRecord): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO schematics
       (id, name, display_name, description, author_name, filename, blockcodes, cuboid_count,
        uploaded_at, uploader_token, download_count, collection_id, collection_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.name,
      record.display_name,
      record.description,
      record.author_name ?? null,
      record.filename,
      record.blockcodes,
      record.cuboid_count,
      record.uploaded_at,
      record.uploader_token,
      record.download_count ?? 0,
      record.collection_id ?? null,
      record.collection_order ?? 0,
    ]
  );
}

export async function deleteSchematic(id: string): Promise<void> {
  const pool = await db();
  await pool.execute('DELETE FROM schematics WHERE id = ?', [id]);
}

export async function updateSchematicMeta(
  id: string,
  fields: { display_name: string; description: string | null; author_name: string | null }
): Promise<void> {
  const pool = await db();
  await pool.execute(
    'UPDATE schematics SET display_name = ?, description = ?, author_name = ? WHERE id = ?',
    [fields.display_name, fields.description, fields.author_name, id]
  );
}

export async function setSchematicOrders(
  updates: Array<{ id: string; collection_order: number }>
): Promise<void> {
  if (!updates.length) return;
  const pool = await db();
  const cases  = updates.map(() => 'WHEN ? THEN ?').join(' ');
  const inList = updates.map(() => '?').join(', ');
  const params = [
    ...updates.flatMap(u => [u.id, u.collection_order]),
    ...updates.map(u => u.id),
  ];
  await pool.execute(
    `UPDATE schematics SET collection_order = CASE id ${cases} END WHERE id IN (${inList})`,
    params
  );
}

export async function incrementDownloadCount(id: string): Promise<void> {
  const pool = await db();
  await pool.execute(
    'UPDATE schematics SET download_count = download_count + 1 WHERE id = ?',
    [id]
  );
}

// ─── Likes ───────────────────────────────────────────────────────────────────

export async function getLikeCount(schematicId: string): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM likes WHERE schematic_id = ?',
    [schematicId]
  );
  return (rows[0] as { count: number }).count;
}

export async function hasLiked(schematicId: string, voterToken: string): Promise<boolean> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM likes WHERE schematic_id = ? AND voter_token = ?',
    [schematicId, voterToken]
  );
  return rows.length > 0;
}

/** Toggles the like for a given voter. Returns true if now liked, false if unliked. */
export async function toggleLike(schematicId: string, voterToken: string): Promise<boolean> {
  const pool = await db();
  // INSERT IGNORE: succeeds (affectedRows=1) if not yet liked → liked.
  // Duplicate key silently ignored (affectedRows=0) → already liked, so delete → unliked.
  const [ins] = await pool.execute<ResultSetHeader>(
    'INSERT IGNORE INTO likes (schematic_id, voter_token, liked_at) VALUES (?, ?, ?)',
    [schematicId, voterToken, Math.floor(Date.now() / 1000)]
  );
  if (ins.affectedRows > 0) return true;
  await pool.execute(
    'DELETE FROM likes WHERE schematic_id = ? AND voter_token = ?',
    [schematicId, voterToken]
  );
  return false;
}

// ─── Collections ─────────────────────────────────────────────────────────────

export async function insertCollection(record: CollectionRecord): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO collections (id, name, description, author_name, uploader_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [record.id, record.name, record.description, record.author_name ?? null, record.uploader_token, record.created_at]
  );
}

export async function getCollection(id: string): Promise<CollectionRecord | undefined> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM collections WHERE id = ?',
    [id]
  );
  return rows[0] as CollectionRecord | undefined;
}

/** Returns the schematics belonging to a collection, in display order. */
export async function getCollectionSchematics(collectionId: string): Promise<SchematicRecord[]> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM likes WHERE schematic_id = s.id) AS like_count
     FROM schematics s
     WHERE s.collection_id = ?
     ORDER BY s.collection_order ASC, s.uploaded_at ASC`,
    [collectionId]
  );
  return rows as SchematicRecord[];
}

export async function listCollections(
  limit = 12,
  offset = 0,
  sort: 'newest' | 'most_liked' = 'newest'
): Promise<CollectionRecord[]> {
  const pool = await db();
  const orderBy = sort === 'most_liked'
    ? 'like_count DESC, c.created_at DESC'
    : 'c.created_at DESC';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM collection_likes WHERE collection_id = c.id) AS like_count,
       (SELECT COUNT(*) FROM schematics WHERE collection_id = c.id) AS schematic_count
     FROM collections c
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows as CollectionRecord[];
}

export async function countCollections(): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM collections'
  );
  return (rows[0] as { count: number }).count;
}

export async function searchCollections(
  query: string,
  limit = 12,
  offset = 0,
  sort: 'newest' | 'most_liked' = 'newest'
): Promise<CollectionRecord[]> {
  const pool = await db();
  const like = `%${query}%`;
  const orderBy = sort === 'most_liked'
    ? 'like_count DESC, c.created_at DESC'
    : 'c.created_at DESC';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM collection_likes WHERE collection_id = c.id) AS like_count,
       (SELECT COUNT(*) FROM schematics WHERE collection_id = c.id) AS schematic_count
     FROM collections c
     WHERE c.name LIKE ? OR c.description LIKE ?
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [like, like, limit, offset]
  );
  return rows as CollectionRecord[];
}

export async function countCollectionSearchResults(query: string): Promise<number> {
  const pool = await db();
  const like = `%${query}%`;
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM collections WHERE name LIKE ? OR description LIKE ?',
    [like, like]
  );
  return (rows[0] as { count: number }).count;
}

export async function deleteCollection(id: string): Promise<void> {
  const pool = await db();
  await pool.execute('DELETE FROM collections WHERE id = ?', [id]);
}

export async function updateCollectionMeta(
  id: string,
  fields: { name: string; description: string | null; author_name: string | null }
): Promise<void> {
  const pool = await db();
  await pool.execute(
    'UPDATE collections SET name = ?, description = ?, author_name = ? WHERE id = ?',
    [fields.name, fields.description, fields.author_name, id]
  );
}

// ─── Collection Likes ────────────────────────────────────────────────────────

/** Likes every schematic in a collection for a voter in one query (skips already-liked). */
export async function likeAllCollectionSchematics(collectionId: string, voterToken: string): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT IGNORE INTO likes (schematic_id, voter_token, liked_at)
     SELECT id, ?, ? FROM schematics WHERE collection_id = ?`,
    [voterToken, Math.floor(Date.now() / 1000), collectionId]
  );
}

export async function getCollectionLikeCount(collectionId: string): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM collection_likes WHERE collection_id = ?',
    [collectionId]
  );
  return (rows[0] as { count: number }).count;
}

export async function hasLikedCollection(collectionId: string, voterToken: string): Promise<boolean> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM collection_likes WHERE collection_id = ? AND voter_token = ?',
    [collectionId, voterToken]
  );
  return rows.length > 0;
}

/** Toggles the collection like for a given voter. Returns true if now liked, false if unliked. */
export async function toggleCollectionLike(collectionId: string, voterToken: string): Promise<boolean> {
  const pool = await db();
  const [ins] = await pool.execute<ResultSetHeader>(
    'INSERT IGNORE INTO collection_likes (collection_id, voter_token, liked_at) VALUES (?, ?, ?)',
    [collectionId, voterToken, Math.floor(Date.now() / 1000)]
  );
  if (ins.affectedRows > 0) return true;
  await pool.execute(
    'DELETE FROM collection_likes WHERE collection_id = ? AND voter_token = ?',
    [collectionId, voterToken]
  );
  return false;
}

// ─── Collection Images ────────────────────────────────────────────────────────

export async function insertCollectionImage(record: CollectionImageRecord): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO collection_images (id, collection_id, display_order, ext, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [record.id, record.collection_id, record.display_order, record.ext, record.created_at]
  );
}

export async function getCollectionImages(collectionId: string): Promise<CollectionImageRecord[]> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM collection_images WHERE collection_id = ? ORDER BY display_order ASC',
    [collectionId]
  );
  return rows as CollectionImageRecord[];
}

export async function deleteCollectionImage(id: string): Promise<void> {
  const pool = await db();
  await pool.execute('DELETE FROM collection_images WHERE id = ?', [id]);
}

export async function setCollectionImageOrders(
  updates: Array<{ id: string; display_order: number }>
): Promise<void> {
  if (!updates.length) return;
  const pool = await db();
  const cases  = updates.map(() => 'WHEN ? THEN ?').join(' ');
  const inList = updates.map(() => '?').join(', ');
  const params = [
    ...updates.flatMap(u => [u.id, u.display_order]),
    ...updates.map(u => u.id),
  ];
  await pool.execute(
    `UPDATE collection_images SET display_order = CASE id ${cases} END WHERE id IN (${inList})`,
    params
  );
}

export async function setCollectionThumbnailImage(
  collectionId: string,
  imageId: string | null
): Promise<void> {
  const pool = await db();
  await pool.execute(
    'UPDATE collections SET thumbnail_image_id = ? WHERE id = ?',
    [imageId, collectionId]
  );
}

// ─── Collection Reports ───────────────────────────────────────────────────────

export async function insertCollectionReport(
  collectionId: string,
  reporterToken: string,
  reason: string
): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO collection_reports (collection_id, reporter_token, reason, created_at)
     VALUES (?, ?, ?, ?)`,
    [collectionId, reporterToken, reason, Math.floor(Date.now() / 1000)]
  );
}

export async function getCollectionReportCount(collectionId: string): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM collection_reports WHERE collection_id = ?',
    [collectionId]
  );
  return (rows[0] as { count: number }).count;
}

export async function hasReported(collectionId: string, reporterToken: string): Promise<boolean> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM collection_reports WHERE collection_id = ? AND reporter_token = ?',
    [collectionId, reporterToken]
  );
  return rows.length > 0;
}

export async function getReportedCollections(): Promise<
  { id: string; name: string; report_count: number; last_reported_at: number }[]
> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.name,
       COUNT(r.id) AS report_count,
       MAX(r.created_at) AS last_reported_at
     FROM collection_reports r
     JOIN collections c ON c.id = r.collection_id
     GROUP BY c.id, c.name
     ORDER BY report_count DESC, last_reported_at DESC`
  );
  return rows as { id: string; name: string; report_count: number; last_reported_at: number }[];
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: number;
  ip: string;
  user_agent: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  voter_token: string | null;
  status: string;
  details: string | null;
}

export async function insertLog(entry: LogEntry): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO logs
       (timestamp, ip, user_agent, action, resource_type, resource_id, voter_token, status, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.timestamp,
      entry.ip,
      entry.user_agent,
      entry.action,
      entry.resource_type,
      entry.resource_id,
      entry.voter_token,
      entry.status,
      entry.details,
    ]
  );
}
