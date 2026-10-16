import 'dotenv/config';
import express from 'express';
import { db, reputation } from './db.js';
import { startPayment, finishPayment, type PendingPayment } from './openPayments.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// Estado completo del círculo: miembros, libro de aportes, desembolsos, reputación
app.get('/api/circles/:id', (req, res) => {
  const id = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(id);
  if (!circle) return res.status(404).json({ error: 'No existe' });
  const members = db.prepare('SELECT * FROM members WHERE circle_id=? ORDER BY turn').all(id);
  const ledger = db.prepare(`SELECT c.id, m.name, m.country, c.round, c.receive_value, c.debit_json, c.status, c.created_at
    FROM contributions c JOIN members m ON m.id=c.member_id WHERE c.circle_id=? ORDER BY c.id DESC`).all(id);
  const payouts = db.prepare(`SELECT p.*, m.name,
    (SELECT COUNT(*) FROM approvals a WHERE a.payout_id=p.id) approvals
    FROM payouts p JOIN members m ON m.id=p.member_id WHERE p.circle_id=?`).all(id);
  res.json({ circle, members, ledger, payouts, reputation: reputation(id) });
});

// 1) Solicitud de aporte -> devuelve URL de autorización en la billetera del miembro
app.post('/api/circles/:id/contribute', async (req, res) => {
  try {
    const circleId = Number(req.params.id);
    const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
    const member = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body.memberId, circleId) as any;
    if (!circle || !member) return res.status(404).json({ error: 'Círculo o miembro no existe' });

    const row = db.prepare('INSERT INTO contributions (circle_id, member_id, round, receive_value) VALUES (?,?,?,?)')
      .run(circleId, member.id, circle.round, String(circle.contribution));
    const contributionId = Number(row.lastInsertRowid);

    try {
      const { redirectUrl, state } = await startPayment({
        senderWallet: member.wallet,
        receiverWallet: circle.pot_wallet,
        receiveValue: String(circle.contribution),
        finishUri: `${BASE}/api/contributions/${contributionId}/finish`,
      });
      db.prepare('UPDATE contributions SET pending_json=?, debit_json=? WHERE id=?')
        .run(JSON.stringify(state), JSON.stringify(state.debit), contributionId);
      res.json({ contributionId, redirectUrl, debit: state.debit, receive: state.receive, expiresAt: state.expiresAt });
    } catch (e) {
      // Si Open Payments falla antes de la autorización, no dejar un aporte "pendiente" colgado en el libro
      db.prepare("UPDATE contributions SET status='failed' WHERE id=?").run(contributionId);
      throw e;
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 2) Callback de autorización: verifica, ejecuta el pago y confirma en el libro
app.get('/api/contributions/:id/finish', async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM contributions WHERE id=?').get(id) as any;
  if (!row) return res.status(404).send('Aporte no encontrado');
  // Un callback ya procesado (recarga del navegador, reenvío) no debe ejecutar otro pago
  if (!row.pending_json || row.status !== 'pending') return res.redirect(`/?circle=${row.circle_id}`);
  try {
    if (req.query.result === 'grant_rejected') throw new Error('El miembro rechazó el pago');
    const outgoing = await finishPayment({
      state: JSON.parse(row.pending_json) as PendingPayment,
      interactRef: String(req.query.interact_ref),
      hash: String(req.query.hash),
    });
    db.prepare("UPDATE contributions SET status='confirmed', outgoing_id=?, pending_json=NULL WHERE id=?").run(outgoing.id, id);
    res.redirect(`/?circle=${row.circle_id}&ok=1`);
  } catch (e: any) {
    console.error(e);
    db.prepare("UPDATE contributions SET status='failed' WHERE id=?").run(id);
    res.redirect(`/?circle=${row.circle_id}&error=${encodeURIComponent(e.message)}`);
  }
});

// 3) Desembolso al miembro que le toca el turno; requiere M aprobaciones
app.post('/api/circles/:id/payouts', (req, res) => {
  const circleId = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
  const members = (db.prepare('SELECT COUNT(*) n FROM members WHERE circle_id=?').get(circleId) as any).n;
  const r = db.prepare('INSERT INTO payouts (circle_id, member_id, round, amount) VALUES (?,?,?,?)')
    .run(circleId, req.body.memberId, circle.round, String(circle.contribution * members));
  res.json({ payoutId: r.lastInsertRowid });
});

app.post('/api/payouts/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const payout = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(payout.circle_id) as any;
  if (req.body.memberId === payout.member_id) return res.status(400).json({ error: 'No puedes aprobar tu propio desembolso' });
  db.prepare('INSERT OR IGNORE INTO approvals (payout_id, member_id) VALUES (?,?)').run(id, req.body.memberId);
  const n = (db.prepare('SELECT COUNT(*) n FROM approvals WHERE payout_id=?').get(id) as any).n;
  if (n >= circle.min_approvals) db.prepare("UPDATE payouts SET status='approved' WHERE id=?").run(id);
  res.json({ approvals: n, needed: circle.min_approvals });
});

app.listen(Number(process.env.PORT ?? 3000), () => console.log(`Círculos en ${BASE}`));
