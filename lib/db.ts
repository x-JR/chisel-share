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

    _schemaReady = _pool.execute(`
      CREATE TABLE IF NOT EXISTS schematics (
        id           VARCHAR(36)  NOT NULL,
        name         TEXT         NOT NULL,
        display_name TEXT         DEFAULT NULL,
        description  TEXT         DEFAULT NULL,
        filename     VARCHAR(255) NOT NULL,
        blockcodes   MEDIUMTEXT   NOT NULL,
        cuboid_count    INT          NOT NULL DEFAULT 0,
        uploaded_at     INT          NOT NULL,
        uploader_token  VARCHAR(36)  DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
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
}

export async function listSchematics(limit = 24, offset = 0): Promise<SchematicRecord[]> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM schematics ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return rows as SchematicRecord[];
}

export async function getSchematic(id: string): Promise<SchematicRecord | undefined> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM schematics WHERE id = ?',
    [id]
  );
  return rows[0] as SchematicRecord | undefined;
}

export async function insertSchematic(record: SchematicRecord): Promise<void> {
  const pool = await db();
  await pool.execute(
    `INSERT INTO schematics
       (id, name, display_name, description, filename, blockcodes, cuboid_count, uploaded_at, uploader_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
}

export async function deleteSchematic(id: string): Promise<void> {
  const pool = await db();
  await pool.execute('DELETE FROM schematics WHERE id = ?', [id]);
}

export async function countSchematics(): Promise<number> {
  const pool = await db();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM schematics'
  );
  return (rows[0] as { count: number }).count;
}
