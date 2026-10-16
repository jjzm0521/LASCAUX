import 'dotenv/config';
import express from 'express';
import { db, reputation } from './db.js';
import { startPayment, finishPayment, type PendingPayment } from './openPayments.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

interface AmountInfo {
  value: string;
  assetCode: string;
  assetScale: number;
}

function parseAmount(raw: string | null | undefined): AmountInfo | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.value === 'string' && typeof p.assetCode === 'string' && typeof p.assetScale === 'number') {
      return { value: p.value, assetCode: p.assetCode, assetScale: p.assetScale };
    }
  } catch {}
  return null;
}

// Si el servidor cayó durante un callback en vuelo antes de consumir el grant, recupera a 'pending' los registros con pending_json.
// Límite: si cae después de consumir grant.continue o de crear el outgoing-payment remoto, el continueToken ya fue usado y no es reintentable.
db.prepare("UPDATE contributions SET status='pending' WHERE status='processing' AND pending_json IS NOT NULL").run();

// Pasa a 'failed' los aportes 'pending' cuya cotización (pending_json.expiresAt) ya venció
function expirePendingContributions(circleId?: number) {
  const rows = (circleId !== undefined
    ? db.prepare("SELECT id, pending_json, expires_at FROM contributions WHERE circle_id=? AND status='pending'").all(circleId)
    : db.prepare("SELECT id, pending_json, expires_at FROM contributions WHERE status='pending'").all()) as any[];
  const now = Date.now();
  const markFailed = db.prepare(
    "UPDATE contributions SET status='failed', error_msg=COALESCE(error_msg, 'La cotización venció, vuelve a intentar') WHERE id=? AND status='pending'",
  );
  for (const r of rows) {
    let exp = r.expires_at as string | undefined;
    if (!exp && r.pending_json) {
      try {
        exp = (JSON.parse(r.pending_json) as PendingPayment).expiresAt;
      } catch {
        markFailed.run(r.id);
        continue;
      }
    }
    if (exp && now >= Date.parse(exp)) {
      markFailed.run(r.id);
    }
  }
}

// Estado completo del círculo: miembros, libro de aportes, desembolsos, reputación
app.get('/api/circles/:id', (req, res) => {
  const id = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(id) as any;
  if (!circle) return res.status(404).json({ error: 'No existe' });

  expirePendingContributions(id);

  const rawMembers = db.prepare('SELECT * FROM members WHERE circle_id=? ORDER BY turn').all(id) as any[];
  const currentTurn = rawMembers.length ? ((circle.round - 1) % rawMembers.length) + 1 : 1;

  const activeRoundContribs = new Set(
    (
      db.prepare(
        "SELECT member_id FROM contributions WHERE circle_id=? AND round=? AND status IN ('confirmed','processing')",
      ).all(id, circle.round) as { member_id: number }[]
    ).map((r) => r.member_id),
  );
  const hasRoundPayout = Boolean(
    db.prepare('SELECT id FROM payouts WHERE circle_id=? AND round=?').get(id, circle.round),
  );

  const members = rawMembers.map((m) => ({
    ...m,
    hasContributed: activeRoundContribs.has(m.id),
    canRequestPayout: !hasRoundPayout && (circle.kind === 'circulo' || m.turn === currentTurn),
  }));

  const rawLedger = db.prepare(`SELECT c.id, c.member_id, m.name, m.country, c.round, c.receive_value, c.debit_json, c.receive_json, c.pending_json, c.status, c.created_at
    FROM contributions c JOIN members m ON m.id=c.member_id WHERE c.circle_id=? ORDER BY c.id DESC`).all(id) as any[];

  const ledger = rawLedger.map((r) => {
    const debit = parseAmount(r.debit_json);
    let receive = parseAmount(r.receive_json);
    if (!receive && r.pending_json) {
      try {
        receive = parseAmount(JSON.stringify((JSON.parse(r.pending_json) as PendingPayment).receive));
      } catch {}
    }
    return {
      id: r.id,
      member_id: r.member_id,
      name: r.name,
      country: r.country,
      round: r.round,
      receive_value: r.receive_value,
      debit,
      receive,
      status: r.status === 'processing' ? 'pending' : r.status,
      created_at: r.created_at,
    };
  });

  const rawPayouts = db.prepare(`SELECT p.*, m.name,
    (SELECT COUNT(*) FROM approvals a WHERE a.payout_id=p.id) approvals
    FROM payouts p JOIN members m ON m.id=p.member_id WHERE p.circle_id=? ORDER BY p.id DESC`).all(id) as any[];
  const approvalsStmt = db.prepare('SELECT member_id FROM approvals WHERE payout_id=? ORDER BY member_id');
  const payouts = rawPayouts.map((p) => ({
    ...p,
    approvedBy: (approvalsStmt.all(p.id) as { member_id: number }[]).map((a) => a.member_id),
  }));

  res.json({ circle: { ...circle, currentTurn }, members, ledger, payouts, reputation: reputation(id) });
});

// Estado individual de un aporte para el stepper de la interfaz
app.get('/api/contributions/:id', (req, res) => {
  const id = Number(req.params.id);
  const initial = db.prepare('SELECT circle_id FROM contributions WHERE id=?').get(id) as { circle_id: number } | undefined;
  if (!initial) return res.status(404).json({ error: 'Aporte no encontrado' });

  expirePendingContributions(initial.circle_id);

  const row = db.prepare('SELECT * FROM contributions WHERE id=?').get(id) as any;
  const debit = parseAmount(row.debit_json);
  let receive = parseAmount(row.receive_json);
  let expiresAt: string | null = row.expires_at ?? null;
  if (row.pending_json) {
    try {
      const state = JSON.parse(row.pending_json) as PendingPayment;
      if (!receive) receive = parseAmount(JSON.stringify(state.receive));
      if (!expiresAt && state.expiresAt) expiresAt = state.expiresAt;
    } catch {}
  }

  const out: Record<string, any> = {
    id: row.id,
    circleId: row.circle_id,
    memberId: row.member_id,
    round: row.round,
    status: row.status,
    expiresAt,
    debit,
    receive,
  };
  if (row.error_msg) out.error = row.error_msg;
  res.json(out);
});

// 1) Solicitud de aporte -> devuelve URL de autorización en la billetera del miembro
app.post('/api/circles/:id/contribute', async (req, res) => {
  try {
    const circleId = Number(req.params.id);
    const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
    const member = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body?.memberId, circleId) as any;
    if (!circle || !member) return res.status(404).json({ error: 'Círculo o miembro no existe' });

    expirePendingContributions(circleId);

    // Regla: un solo aporte confirmado (o en confirmación activa) por miembro por ronda
    const activeOrConfirmed = db.prepare(
      "SELECT status FROM contributions WHERE circle_id=? AND member_id=? AND round=? AND status IN ('confirmed','processing')",
    ).get(circleId, member.id, circle.round) as any;
    if (activeOrConfirmed) {
      return res.status(400).json({
        error: activeOrConfirmed.status === 'processing'
          ? 'Tu aporte se está confirmando en este momento'
          : 'Ya tienes un aporte confirmado en esta ronda',
      });
    }

    // Si el miembro tenía un aporte 'pending' abandonado en la misma ronda, pasa a 'failed' al pedir uno nuevo
    db.prepare(
      "UPDATE contributions SET status='failed', pending_json=NULL, error_msg='Reemplazado por un nuevo intento de aporte' WHERE circle_id=? AND member_id=? AND round=? AND status='pending'",
    ).run(circleId, member.id, circle.round);

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
      db.prepare('UPDATE contributions SET pending_json=?, debit_json=?, receive_json=?, expires_at=? WHERE id=?')
        .run(
          JSON.stringify(state),
          JSON.stringify(state.debit),
          JSON.stringify(state.receive),
          state.expiresAt ?? null,
          contributionId,
        );
      res.json({ contributionId, redirectUrl, debit: state.debit, receive: state.receive, expiresAt: state.expiresAt });
    } catch (e: any) {
      // Si Open Payments falla antes de la autorización, no dejar un aporte "pendiente" colgado en el libro
      db.prepare("UPDATE contributions SET status='failed', error_msg=? WHERE id=?").run(e?.message ?? 'Error al iniciar el pago', contributionId);
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
  // Un callback ya procesado o en curso no debe ejecutar otro pago
  if (!row.pending_json || row.status === 'confirmed' || row.status === 'processing') {
    return res.redirect(`/?circle=${row.circle_id}`);
  }

  // Reserva atómica antes del primer await sin borrar pending_json (si el proceso cae durante el await, al reiniciar recupera pending_json)
  const claim = db.prepare(
    "UPDATE contributions SET status='processing' WHERE id=? AND pending_json IS NOT NULL AND status IN ('pending','failed')",
  ).run(id);
  if (claim.changes === 0) return res.redirect(`/?circle=${row.circle_id}`);

  try {
    if (req.query.result === 'grant_rejected') throw new Error('El miembro rechazó el pago');
    const outgoing = await finishPayment({
      state: JSON.parse(row.pending_json) as PendingPayment,
      interactRef: String(req.query.interact_ref),
      hash: String(req.query.hash),
    });
    db.prepare(
      "UPDATE contributions SET status='confirmed', outgoing_id=?, pending_json=NULL, error_msg=NULL WHERE id=? AND status='processing'",
    ).run(outgoing.id, id);
    res.redirect(`/?circle=${row.circle_id}&ok=1`);
  } catch (e: any) {
    console.error(e);
    db.prepare(
      "UPDATE contributions SET status='failed', pending_json=NULL, error_msg=? WHERE id=? AND status='processing'",
    ).run(e?.message ?? 'Error al confirmar el aporte', id);
    res.redirect(`/?circle=${row.circle_id}&error=${encodeURIComponent(e.message)}`);
  }
});

// 3) Desembolso: en 'cadena'/'natillera' respeta el turno de la ronda; en 'circulo' (modelo Corporación Fomentamos)
//    cualquier miembro puede solicitar un desembolso/crédito solidario respaldado por M aprobaciones del grupo.
app.post('/api/circles/:id/payouts', (req, res) => {
  const circleId = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
  if (!circle) return res.status(404).json({ error: 'Círculo no existe' });

  const member = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body?.memberId, circleId) as any;
  if (!member) return res.status(404).json({ error: 'Miembro no pertenece al círculo' });

  const members = (db.prepare('SELECT COUNT(*) n FROM members WHERE circle_id=?').get(circleId) as any).n;
  if (!members) return res.status(400).json({ error: 'El círculo no tiene miembros' });

  const existing = db.prepare('SELECT id FROM payouts WHERE circle_id=? AND round=?').get(circleId, circle.round);
  if (existing) {
    return res.status(400).json({ error: `Ya existe un desembolso registrado en la ronda ${circle.round}` });
  }

  if (circle.kind !== 'circulo') {
    const expectedTurn = ((circle.round - 1) % members) + 1;
    if (member.turn !== expectedTurn) {
      return res.status(400).json({ error: `En la ronda ${circle.round} el turno de desembolso corresponde al turno ${expectedTurn}` });
    }
  }

  const defaultAmount = String(circle.contribution * members);
  const customAmount = req.body?.amount !== undefined ? String(Math.trunc(Number(req.body.amount))) : null;
  const amount = customAmount && Number(customAmount) > 0 ? customAmount : defaultAmount;
  const purpose = typeof req.body?.purpose === 'string' && req.body.purpose.trim() ? req.body.purpose.trim() : null;

  const r = db.prepare('INSERT INTO payouts (circle_id, member_id, round, amount, purpose) VALUES (?,?,?,?,?)')
    .run(circleId, member.id, circle.round, amount, purpose);
  res.json({ payoutId: Number(r.lastInsertRowid), amount, purpose, round: circle.round });
});

app.post('/api/payouts/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const payout = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
  if (!payout) return res.status(404).json({ error: 'Desembolso no existe' });

  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(payout.circle_id) as any;
  if (!circle) return res.status(404).json({ error: 'Círculo no existe' });

  const approver = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body?.memberId, circle.id) as any;
  if (!approver) return res.status(404).json({ error: 'Miembro aprobador no pertenece al círculo' });

  if (approver.id === payout.member_id) {
    return res.status(400).json({ error: 'No puedes aprobar tu propio desembolso' });
  }

  db.prepare('INSERT OR IGNORE INTO approvals (payout_id, member_id) VALUES (?,?)').run(id, approver.id);
  const n = (db.prepare('SELECT COUNT(*) n FROM approvals WHERE payout_id=?').get(id) as any).n;

  let status = payout.status;
  let round = circle.round;
  if (n >= circle.min_approvals && payout.status !== 'approved') {
    status = 'approved';
    db.prepare("UPDATE payouts SET status='approved' WHERE id=?").run(id);
    // Cierre de ronda al alcanzar las M aprobaciones solidarias
    if (circle.round === payout.round) {
      round = circle.round + 1;
      db.prepare('UPDATE circles SET round=? WHERE id=?').run(round, circle.id);
    }
  }
  res.json({ approvals: n, needed: circle.min_approvals, status, round });
});

app.listen(Number(process.env.PORT ?? 3000), () => console.log(`Círculos en ${BASE}`));
