import Database from 'better-sqlite3';

export const db = new Database(process.env.DB_PATH ?? 'circulos.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'natillera',   -- natillera | cadena | circulo
  pot_wallet TEXT NOT NULL,                  -- billetera destino (caja del círculo)
  contribution INTEGER,                      -- unidades mínimas del activo de la caja (solo en cadena)
  min_approvals INTEGER NOT NULL DEFAULT 2,  -- aprobaciones necesarias para un desembolso o cierre
  round INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',       -- open | closed
  asset_code TEXT DEFAULT 'USD',
  asset_scale INTEGER DEFAULT 2
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  wallet TEXT NOT NULL,                      -- billetera propia (puede estar en otra moneda)
  asset_code TEXT,                           -- moneda de la billetera del miembro (ej. COP, USD)
  turn INTEGER NOT NULL                      -- orden de cobro (cadena)
);
CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  round INTEGER NOT NULL,
  receive_value TEXT NOT NULL,
  receive_json TEXT,
  debit_json TEXT,
  expires_at TEXT,
  error_msg TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | processing | confirmed | failed
  pending_json TEXT,
  outgoing_id TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  round INTEGER NOT NULL,
  amount TEXT NOT NULL,
  purpose TEXT,                              -- destino o motivo del desembolso solidario (modelo Fomentamos)
  kind TEXT NOT NULL DEFAULT 'entrega',      -- entrega | reparto
  closing_id INTEGER,
  status TEXT NOT NULL DEFAULT 'requested',  -- requested | approved | paying | paid | failed
  outgoing_id TEXT,
  paid_at TEXT,
  debit_json TEXT,
  receive_json TEXT,
  pending_json TEXT,
  expires_at TEXT,
  error_msg TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS approvals (
  payout_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  PRIMARY KEY (payout_id, member_id)
);
CREATE TABLE IF NOT EXISTS closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',   -- proposed | approved | paying | done
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS closing_approvals (
  closing_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  PRIMARY KEY (closing_id, member_id)
);
`);

// Migración ligera para bases circulos.db ya creadas antes de agregar columnas nuevas
const circleCols = db.prepare('PRAGMA table_info(circles)').all() as { name: string; notnull: number }[];
for (const [col, def] of [
  ['status', "TEXT NOT NULL DEFAULT 'open'"],
  ['asset_code', "TEXT DEFAULT 'USD'"],
  ['asset_scale', 'INTEGER DEFAULT 2'],
] as const) {
  if (!circleCols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE circles ADD COLUMN ${col} ${def}`);
  }
}
if (circleCols.find((c) => c.name === 'contribution')?.notnull === 1) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE circles_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'natillera',
      pot_wallet TEXT NOT NULL,
      contribution INTEGER,
      min_approvals INTEGER NOT NULL DEFAULT 2,
      round INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'open',
      asset_code TEXT DEFAULT 'USD',
      asset_scale INTEGER DEFAULT 2
    );
    INSERT INTO circles_v2 (id, name, kind, pot_wallet, contribution, min_approvals, round, status, asset_code, asset_scale)
      SELECT id, name, kind, pot_wallet, CASE WHEN kind='cadena' THEN contribution ELSE NULL END, min_approvals, round,
             COALESCE(status, 'open'), COALESCE(asset_code, 'USD'), COALESCE(asset_scale, 2)
      FROM circles;
    DROP TABLE circles;
    ALTER TABLE circles_v2 RENAME TO circles;
  `);
  db.pragma('foreign_keys = ON');
}

const memberCols = db.prepare('PRAGMA table_info(members)').all() as { name: string }[];
if (!memberCols.some((c) => c.name === 'asset_code')) {
  db.exec('ALTER TABLE members ADD COLUMN asset_code TEXT');
}
const contribCols = db.prepare('PRAGMA table_info(contributions)').all() as { name: string }[];
for (const col of ['receive_json', 'expires_at', 'error_msg', 'confirmed_at']) {
  if (!contribCols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE contributions ADD COLUMN ${col} TEXT`);
  }
}
const payoutCols = db.prepare('PRAGMA table_info(payouts)').all() as { name: string }[];
for (const [col, def] of [
  ['purpose', 'TEXT'],
  ['kind', "TEXT NOT NULL DEFAULT 'entrega'"],
  ['closing_id', 'INTEGER'],
  ['outgoing_id', 'TEXT'],
  ['paid_at', 'TEXT'],
  ['debit_json', 'TEXT'],
  ['receive_json', 'TEXT'],
  ['pending_json', 'TEXT'],
  ['expires_at', 'TEXT'],
  ['error_msg', 'TEXT'],
] as const) {
  if (!payoutCols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE payouts ADD COLUMN ${col} ${def}`);
  }
}

/** Reputación del CÍRCULO según tipo (Contrato v2 sección 1):
 *  - cadena: aportes confirmados / (miembros * ronda)
 *  - natillera y circulo: personas que aportaron en la ronda actual / personas */
export function reputation(circleId: number) {
  const c = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
  if (!c) return { confirmed: 0, expected: 0, score: 0 };
  const members = (db.prepare('SELECT COUNT(*) n FROM members WHERE circle_id=?').get(circleId) as any).n;
  if (c.kind === 'cadena') {
    const confirmed = (db.prepare("SELECT COUNT(*) n FROM contributions WHERE circle_id=? AND status='confirmed'").get(circleId) as any).n;
    const expected = members * c.round;
    const score = expected ? Math.round((confirmed / expected) * 100) : 0;
    return { confirmed, expected, score };
  }
  const confirmed = (
    db.prepare(
      "SELECT COUNT(DISTINCT member_id) n FROM contributions WHERE circle_id=? AND round=? AND status='confirmed'",
    ).get(circleId, c.round) as any
  ).n;
  const expected = members;
  const score = expected ? Math.round((confirmed / expected) * 100) : 0;
  return { confirmed, expected, score };
}
