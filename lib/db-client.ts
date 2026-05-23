export interface DbResult {
  changes: number;
  lastId: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<DbResult>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  isPg: boolean;
}

// ---------------------------------------------------------------------------
// SQLite adapter
// ---------------------------------------------------------------------------

class SqliteClient implements DbClient {
  readonly isPg = false;

  private getDb() {
    // lazy require so better-sqlite3 is never loaded when a Postgres URL is set
    const { getDb } = require('./db') as { getDb: () => import('better-sqlite3').Database };
    return getDb();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.getDb().prepare(sql).all(...params) as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const row = this.getDb().prepare(sql).get(...params) as T | undefined;
    return row ?? null;
  }

  async run(sql: string, params: any[] = []): Promise<DbResult> {
    const result = this.getDb().prepare(sql).run(...params);
    return {
      changes: result.changes,
      lastId: Number(result.lastInsertRowid),
    };
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    const db = this.getDb();
    db.prepare('BEGIN').run();
    try {
      const result = await fn(this);
      db.prepare('COMMIT').run();
      return result;
    } catch (err) {
      db.prepare('ROLLBACK').run();
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Postgres helpers
// ---------------------------------------------------------------------------

function transformSql(sql: string): string {
  const hasInsertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);

  let transformed = sql;

  // 1. INSERT OR IGNORE INTO x -> INSERT INTO x
  transformed = transformed.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');

  // 2. datetime('now') -> NOW()
  transformed = transformed.replace(/datetime\('now'\)/gi, 'NOW()');

  // 3. ? -> $1, $2, ...
  let paramIndex = 0;
  transformed = transformed.replace(/\?/g, () => `$${++paramIndex}`);

  // 4. Append ON CONFLICT DO NOTHING
  if (hasInsertOrIgnore) {
    transformed = transformed.trimEnd().replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
  }

  return transformed;
}

// ---------------------------------------------------------------------------
// Postgres adapter
// ---------------------------------------------------------------------------

class PgClient implements DbClient {
  readonly isPg = true;
  private client: any = null;
  private initPromise: Promise<void> | null = null;

  private async getConnectedClient() {
    if (!this.client) {
      const { createClient } = require('@vercel/postgres') as typeof import('@vercel/postgres');
      this.client = createClient({ connectionString: process.env.POSTGRES_URL });
      await this.client.connect();
    }
    return this.client;
  }

  private async ensureInit() {
    if (!this.initPromise) {
      this.initPromise = this._initSchema().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async _initSchema() {
    const pool = await this.getConnectedClient();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'influencer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        brand_name TEXT NOT NULL,
        revenue_share REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tracking_links (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        contract_id BIGINT,
        title TEXT NOT NULL,
        original_url TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (contract_id) REFERENCES contracts(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clicks (
        id BIGSERIAL PRIMARY KEY,
        link_id BIGINT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        clicked_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (link_id) REFERENCES tracking_links(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversions (
        id BIGSERIAL PRIMARY KEY,
        link_id BIGINT NOT NULL,
        order_id TEXT,
        amount REAL NOT NULL,
        commission REAL NOT NULL,
        converted_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (link_id) REFERENCES tracking_links(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cafe24_credentials (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        mall_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TEXT,
        last_synced_at TEXT,
        oauth_state TEXT,
        is_connected INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cafe24_synced_orders (
        id BIGSERIAL PRIMARY KEY,
        credential_id BIGINT NOT NULL,
        order_id TEXT NOT NULL,
        order_date TEXT,
        buyer_name TEXT,
        total_price REAL NOT NULL,
        affiliate_code TEXT,
        link_id BIGINT,
        commission REAL DEFAULT 0,
        is_attributed INTEGER DEFAULT 0,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(credential_id, order_id),
        FOREIGN KEY (credential_id) REFERENCES cafe24_credentials(id),
        FOREIGN KEY (link_id) REFERENCES tracking_links(id)
      )
    `);

    await this._seedDemoData(pool);
  }

  private async _seedDemoData(client: any) {
    const pool = client;
    const bcrypt = require('bcryptjs');

    // Brand demo user
    const brandExists = await pool.query('SELECT id FROM users WHERE email = $1', ['brand@example.com']);
    if (brandExists.rows.length === 0) {
      const brandHash = await bcrypt.hash('brand1234', 8);
      const { rows: [{ id: brandId }] } = await pool.query(
        `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'brand') RETURNING id`,
        ['쿠팡 파트너스 데모', 'brand@example.com', brandHash]
      );
      await pool.query(
        `INSERT INTO cafe24_credentials (user_id, mall_id, client_id, client_secret, is_connected) VALUES ($1,$2,$3,$4,0)`,
        [Number(brandId), 'demomall', 'demo_client_id', 'demo_client_secret']
      );
    }

    // Influencer demo user
    const infExists = await pool.query('SELECT id FROM users WHERE email = $1', ['demo@example.com']);
    if (infExists.rows.length > 0) return;

    const hash = await bcrypt.hash('demo1234', 8);
    const { rows: [{ id: userId }] } = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,'influencer') RETURNING id`,
      ['김지수', 'demo@example.com', hash]
    );
    const uid = Number(userId);

    const { rows: [{ id: c1 }] } = await pool.query(
      `INSERT INTO contracts (user_id, brand_name, revenue_share, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [uid, '쿠팡 파트너스', 5.0, '2026-01-01', '2026-12-31']
    );
    const { rows: [{ id: c2 }] } = await pool.query(
      `INSERT INTO contracts (user_id, brand_name, revenue_share, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [uid, '네이버 쇼핑 파트너', 3.5, '2026-02-01', '2026-07-31']
    );
    const contractId = Number(c1), contractId2 = Number(c2);

    const linkDefs = [
      { title: '갤럭시 S25 링크', url: 'https://coupang.com/product/galaxy-s25', code: 'ABC123', cid: contractId },
      { title: '에어팟 프로 링크', url: 'https://coupang.com/product/airpods-pro', code: 'DEF456', cid: contractId },
      { title: '나이키 운동화 링크', url: 'https://shopping.naver.com/nike-shoes', code: 'GHI789', cid: contractId2 },
    ];

    for (const ld of linkDefs) {
      const { rows: [{ id: lid }] } = await pool.query(
        `INSERT INTO tracking_links (user_id, contract_id, title, original_url, code) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [uid, ld.cid, ld.title, ld.url, ld.code]
      );
      const linkId = Number(lid);
      const share = ld.cid === contractId ? 5.0 : 3.5;

      // Build bulk click rows for 60 days (one INSERT per day to keep latency low)
      for (let i = 59; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const base = d.toISOString().split('T')[0] + 'T12:00:00Z';
        const clickCount = Math.floor(Math.random() * 80) + 10;

        // Bulk INSERT all clicks for this day in one query
        const clickVals: string[] = [];
        const clickParams: any[] = [];
        for (let c = 0; c < clickCount; c++) {
          const off = Math.floor(Math.random() * 720);
          const p = clickParams.length;
          clickVals.push(`($${p + 1}, $${p + 2}::TIMESTAMPTZ - ($${p + 3} || ' minutes')::INTERVAL)`);
          clickParams.push(linkId, base, String(off));
        }
        await pool.query(`INSERT INTO clicks (link_id, clicked_at) VALUES ${clickVals.join(',')}`, clickParams);

        // Bulk INSERT conversions for this day
        const convCount = Math.floor(Math.random() * 5);
        if (convCount > 0) {
          const convVals: string[] = [];
          const convParams: any[] = [];
          for (let v = 0; v < convCount; v++) {
            const amount = Math.floor(Math.random() * 200000) + 10000;
            const commission = Math.round(amount * share / 100);
            const off = Math.floor(Math.random() * 720);
            const p = convParams.length;
            convVals.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}::TIMESTAMPTZ - ($${p + 5} || ' minutes')::INTERVAL)`);
            convParams.push(linkId, amount, commission, base, String(off));
          }
          await pool.query(`INSERT INTO conversions (link_id, amount, commission, converted_at) VALUES ${convVals.join(',')}`, convParams);
        }
      }
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureInit();
    const transformed = transformSql(sql);
    const client = await this.getConnectedClient();
    const result = await client.query(transformed, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    await this.ensureInit();
    const transformed = transformSql(sql);
    const client = await this.getConnectedClient();
    const result = await client.query(transformed, params);
    return (result.rows[0] as T) ?? null;
  }

  async run(sql: string, params: any[] = []): Promise<DbResult> {
    await this.ensureInit();
    let transformed = transformSql(sql);

    // For INSERT without RETURNING, append RETURNING id
    const isInsert = /^\s*INSERT/i.test(transformed);
    const hasReturning = /RETURNING/i.test(transformed);
    if (isInsert && !hasReturning) {
      transformed = transformed.trimEnd().replace(/;?\s*$/, '') + ' RETURNING id';
    }

    const client = await this.getConnectedClient();
    const result = await client.query(transformed, params);
    return {
      changes: result.rowCount ?? 0,
      lastId: Number(result.rows[0]?.id ?? 0),
    };
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    await this.ensureInit();
    const client = await this.getConnectedClient();
    await client.query('BEGIN');
    try {
      const result = await fn(new PgTxClient(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
}

// Postgres transaction client wrapping a single connection
class PgTxClient implements DbClient {
  readonly isPg = true;
  constructor(private client: any) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const transformed = transformSql(sql);
    const result = await this.client.query(transformed, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const transformed = transformSql(sql);
    const result = await this.client.query(transformed, params);
    return (result.rows[0] as T) ?? null;
  }

  async run(sql: string, params: any[] = []): Promise<DbResult> {
    let transformed = transformSql(sql);

    const isInsert = /^\s*INSERT/i.test(transformed);
    const hasReturning = /RETURNING/i.test(transformed);
    if (isInsert && !hasReturning) {
      transformed = transformed.trimEnd().replace(/;?\s*$/, '') + ' RETURNING id';
    }

    const result = await this.client.query(transformed, params);
    return {
      changes: result.rowCount ?? 0,
      lastId: Number(result.rows[0]?.id ?? 0),
    };
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    // Nested transactions: just run fn with the same tx client (savepoints not needed for our use case)
    return fn(this);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _client: DbClient | null = null;

export function getDbClient(): DbClient {
  if (!_client) {
    if (process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL) {
      _client = new PgClient();
    } else {
      _client = new SqliteClient();
    }
  }
  return _client;
}
