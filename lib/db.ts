import mysql, { RowDataPacket } from 'mysql2/promise';

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
          filename        VARCHAR(255) NOT NULL,
          blockcodes      MEDIUMTEXT   NOT NULL,
          cuboid_count    INT          NOT NULL DEFAULT 0,
          uploaded_at     INT          NOT NULL,
          uploader_token  VARCHAR(36)  DEFAULT NULL,
          download_count  INT          NOT NULL DEFAULT 0,
          collection_id   VARCHAR(36)  DEFAULT NULL,
          collection_order INT         NOT NULL DEFAULT 0,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // Migrations for existing installs
      await pool.execute(`
        ALTER TABLE schematics
          ADD COLUMN IF NOT EXISTS download_count   INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS collection_id    VARCHAR(36) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS collection_order INT NOT NULL DEFAULT 0
      `).catch(() => { /* already present */ });
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS collections (
          id             VARCHAR(36)  NOT NULL,
          name           TEXT         NOT NULL,
          description    TEXT         DEFAULT NULL,
          uploader_token VARCHAR(36)  DEFAULT NULL,
          created_at     INT          NOT NULL,
          PRIMARY KEY (id)
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
  like_count?: number; // populated by queries that include a subquery
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string | null;
  uploader_token: string | null;
  created_at: number; // Unix timestamp (seconds)
  like_count?: number; // populated by queries that include a subquery
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
       (id, name, display_name, description, filename, blockcodes, cuboid_count,
        uploaded_at, uploader_token, download_count, collection_id, collection_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.name,
      record.display_name,
      record.description,
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
  const already = await hasLiked(schematicId, voterToken);
  const pool = await db();
  if (already) {
    await pool.execute(
      'DELETE FROM likes WHERE schematic_id = ? AND voter_token = ?',
      [schematicId, voterToken]
    );
    return false;
  } else {
    await pool.execute(
      'INSERT INTO likes (schematic_id, voter_token, liked_at) VALUES (?, ?, ?)',
      [schematicId, voterToken, Math.floor(Date.now() / 1000)]
    );
    return true;
  }
}

// ─── Collections ─────────────────────────────────────────────────────────────

export async function insertCollection(record: CollectionRecord): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO collections (id, name, description, uploader_token, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [record.id, record.name, record.description, record.uploader_token, record.created_at]
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
       (SELECT COUNT(*) FROM collection_likes WHERE collection_id = c.id) AS like_count
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
       (SELECT COUNT(*) FROM collection_likes WHERE collection_id = c.id) AS like_count
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

// ─── Collection Likes ────────────────────────────────────────────────────────

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
  const already = await hasLikedCollection(collectionId, voterToken);
  const pool = await db();
  if (already) {
    await pool.execute(
      'DELETE FROM collection_likes WHERE collection_id = ? AND voter_token = ?',
      [collectionId, voterToken]
    );
    return false;
  } else {
    await pool.execute(
      'INSERT INTO collection_likes (collection_id, voter_token, liked_at) VALUES (?, ?, ?)',
      [collectionId, voterToken, Math.floor(Date.now() / 1000)]
    );
    return true;
  }
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
