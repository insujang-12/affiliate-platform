import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'affiliate.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'influencer',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      brand_name TEXT NOT NULL,
      revenue_share REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tracking_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contract_id INTEGER,
      title TEXT NOT NULL,
      original_url TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT,
      clicked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (link_id) REFERENCES tracking_links(id)
    );

    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      order_id TEXT,
      amount REAL NOT NULL,
      commission REAL NOT NULL,
      converted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (link_id) REFERENCES tracking_links(id)
    );

    CREATE TABLE IF NOT EXISTS cafe24_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mall_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      last_synced_at TEXT,
      oauth_state TEXT,
      is_connected INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cafe24_synced_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id INTEGER NOT NULL,
      order_id TEXT NOT NULL,
      order_date TEXT,
      buyer_name TEXT,
      total_price REAL NOT NULL,
      affiliate_code TEXT,
      link_id INTEGER,
      commission REAL DEFAULT 0,
      is_attributed INTEGER DEFAULT 0,
      synced_at TEXT DEFAULT (datetime('now')),
      UNIQUE(credential_id, order_id),
      FOREIGN KEY (credential_id) REFERENCES cafe24_credentials(id),
      FOREIGN KEY (link_id) REFERENCES tracking_links(id)
    );
  `);

  // Safely add role column to existing users table
  try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'influencer'");
  } catch {
    // Column already exists
  }

  // Safely add order_id column to conversions (added when Cafe24 sync was introduced)
  try {
    db.exec("ALTER TABLE conversions ADD COLUMN order_id TEXT");
  } catch {
    // Column already exists
  }

  seedDemoData(db);
}

function seedDemoData(db: Database.Database) {
  const bcrypt = require('bcryptjs');

  // Seed brand demo user (independent from influencer)
  const brandExists = db.prepare('SELECT id FROM users WHERE email = ?').get('brand@example.com');
  if (!brandExists) {
    const brandHash = bcrypt.hashSync('brand1234', 10);
    const brandId = (db.prepare(`
      INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'brand')
    `).run('쿠팡 파트너스 데모', 'brand@example.com', brandHash)).lastInsertRowid;

    db.prepare(`
      INSERT INTO cafe24_credentials (user_id, mall_id, client_id, client_secret, is_connected)
      VALUES (?, ?, ?, ?, 0)
    `).run(brandId, 'demomall', 'demo_client_id', 'demo_client_secret');
  }

  // Seed influencer demo user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@example.com');
  if (existing) return;

  const hash = bcrypt.hashSync('demo1234', 10);

  const userId = (db.prepare(`
    INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'influencer')
  `).run('김지수', 'demo@example.com', hash)).lastInsertRowid;

  const contractId = (db.prepare(`
    INSERT INTO contracts (user_id, brand_name, revenue_share, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, '쿠팡 파트너스', 5.0, '2026-01-01', '2026-12-31')).lastInsertRowid;

  const contractId2 = (db.prepare(`
    INSERT INTO contracts (user_id, brand_name, revenue_share, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, '네이버 쇼핑 파트너', 3.5, '2026-02-01', '2026-07-31')).lastInsertRowid;

  const links = [
    { title: '갤럭시 S25 링크', url: 'https://coupang.com/product/galaxy-s25', code: 'ABC123', contractId },
    { title: '에어팟 프로 링크', url: 'https://coupang.com/product/airpods-pro', code: 'DEF456', contractId },
    { title: '나이키 운동화 링크', url: 'https://shopping.naver.com/nike-shoes', code: 'GHI789', contractId: contractId2 },
  ];

  for (const link of links) {
    const linkId = (db.prepare(`
      INSERT INTO tracking_links (user_id, contract_id, title, original_url, code)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, link.contractId, link.title, link.url, link.code)).lastInsertRowid;

    for (let i = 59; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const clickCount = Math.floor(Math.random() * 80) + 10;
      for (let c = 0; c < clickCount; c++) {
        db.prepare(`
          INSERT INTO clicks (link_id, clicked_at) VALUES (?, datetime(?, '-' || ? || ' minutes'))
        `).run(linkId, dateStr + ' 12:00:00', Math.floor(Math.random() * 720));
      }

      const convCount = Math.floor(Math.random() * 5);
      for (let v = 0; v < convCount; v++) {
        const amount = Math.floor(Math.random() * 200000) + 10000;
        const share = link.contractId === contractId ? 5.0 : 3.5;
        const commission = Math.round(amount * share / 100);
        db.prepare(`
          INSERT INTO conversions (link_id, amount, commission, converted_at)
          VALUES (?, ?, ?, datetime(?, '-' || ? || ' minutes'))
        `).run(linkId, amount, commission, dateStr + ' 12:00:00', Math.floor(Math.random() * 720));
      }
    }
  }
}
