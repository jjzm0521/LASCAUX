import Database from 'better-sqlite3';

export const db = new Database(process.env.DB_PATH ?? 'circulos.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'natillera',   -- natillera | cadena | circulo
  pot_wallet TEXT NOT NULL,                  -- billetera destino (caja del círculo)
  contribution INTEGER NOT NULL,             -- unidades mínimas del activo de la caja por aporte
  min_approvals INTEGER NOT NULL DEFAULT 2,  -- aprobaciones necesarias para un desembolso
  round INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  wallet TEXT NOT NULL,                      -- billetera propia (puede estar en otra moneda)
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
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | confirmed | failed
  pending_json TEXT,
  outgoing_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  round INTEGER NOT NULL,
  amount TEXT NOT NULL,
  purpose TEXT,                              -- destino o motivo del desembolso solidario (modelo Fomentamos)
  status TEXT NOT NULL DEFAULT 'requested',  -- requested | approved
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS approvals (
  payout_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  PRIMARY KEY (payout_id, member_id)
);
`);

// Migración ligera para bases circulos.db ya creadas antes de agregar columnas nuevas
const contribCols = db.prepare('PRAGMA table_info(contributions)').all() as { name: string }[];
if (!contribCols.some((c) => c.name === 'receive_json')) {
  db.exec('ALTER TABLE contributions ADD COLUMN receive_json TEXT');
}
const payoutCols = db.prepare('PRAGMA table_info(payouts)').all() as { name: string }[];
if (!payoutCols.some((c) => c.name === 'purpose')) {
  db.exec('ALTER TABLE payouts ADD COLUMN purpose TEXT');
}

/** Reputación del CÍRCULO (transparente, calculada del libro): % de aportes confirmados vs esperados. */
export function reputation(circleId: number) {
  const c = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
  if (!c) return { confirmed: 0, expected: 0, score: 0 };
  const members = (db.prepare('SELECT COUNT(*) n FROM members WHERE circle_id=?').get(circleId) as any).n;
  const confirmed = (db.prepare("SELECT COUNT(*) n FROM contributions WHERE circle_id=? AND status='confirmed'").get(circleId) as any).n;
  const expected = members * c.round;
  const score = expected ? Math.round((confirmed / expected) * 100) : 0;
  return { confirmed, expected, score };
}
