import 'dotenv/config';
import express from 'express';
import { db, reputation } from './db.js';
import { startPayment, finishPayment, toUrl, getClient, type PendingPayment } from './openPayments.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// Límite en memoria para altas de miembros: máximo 10 solicitudes por minuto por IP
const memberRateMap = new Map<string, number[]>();
function checkMemberRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (memberRateMap.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) {
    memberRateMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  memberRateMap.set(ip, recent);
  return true;
}

// Protección SSRF: solo consultar billeteras HTTPS dentro de los dominios permitidos (por defecto .interledger-test.dev)
function isAllowedWalletUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase();
    const allowed = (process.env.ALLOWED_WALLET_HOSTS ?? '.interledger-test.dev')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return allowed.some((rule) =>
      rule.startsWith('.') ? host === rule.slice(1) || host.endsWith(rule) : host === rule || host.endsWith('.' + rule),
    );
  } catch {
    return false;
  }
}

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

// Lista de círculos (más reciente primero) para la pantalla "Tus círculos"
app.get('/api/circles', (_req, res) => {
  const rows = db.prepare(
    `SELECT c.id, c.name, c.kind, c.round, c.contribution, c.min_approvals,
      c.asset_code AS assetCode, c.asset_scale AS assetScale,
      (SELECT COUNT(*) FROM members m WHERE m.circle_id=c.id) AS members
     FROM circles c ORDER BY c.id DESC`,
  ).all();
  res.json({ circles: rows });
});

const MAX_CIRCLES = 20;
const KINDS = ['natillera', 'cadena', 'circulo'];

// Crear un círculo: valida la billetera de la caja contra Open Payments y convierte el aporte a unidades mínimas
app.post('/api/circles', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    if (!checkMemberRateLimit('circulo:' + ip)) {
      return res.status(429).json({ error: 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.' });
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (name.length > 60) return res.status(400).json({ error: 'El nombre no puede superar los 60 caracteres' });

    const kind = req.body?.kind;
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'El tipo de círculo no es válido' });

    const minApprovals = Number(req.body?.min_approvals);
    if (!Number.isInteger(minApprovals) || minApprovals < 1 || minApprovals > 4) {
      return res.status(400).json({ error: 'Las aprobaciones deben ser un número entre 1 y 4' });
    }

    const rawWallet = typeof req.body?.pot_wallet === 'string' ? req.body.pot_wallet.trim() : '';
    if (!rawWallet) return res.status(400).json({ error: 'La billetera de la caja es obligatoria' });
    const walletUrl = toUrl(rawWallet);
    if (!isAllowedWalletUrl(walletUrl)) {
      return res.status(400).json({ error: 'Solo se permiten billeteras de la red de pruebas (.interledger-test.dev)' });
    }

    const amountText = typeof req.body?.amount === 'string' ? req.body.amount.trim() : String(req.body?.amount ?? '');
    if (!/^\d+(\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
      return res.status(400).json({ error: 'El aporte debe ser un número mayor que cero, por ejemplo 10' });
    }

    if ((db.prepare('SELECT COUNT(*) n FROM circles').get() as any).n >= MAX_CIRCLES) {
      return res.status(400).json({ error: 'Ya hay demasiados círculos en este servidor' });
    }

    let wa: { id: string; assetCode: string; assetScale: number };
    try {
      const c = await getClient();
      wa = await c.walletAddress.get({ url: walletUrl });
    } catch {
      return res.status(400).json({ error: 'No encontramos esa billetera. Revisa la dirección.' });
    }
    if (!wa?.id || !wa?.assetCode || typeof wa.assetScale !== 'number') {
      return res.status(400).json({ error: 'No encontramos esa billetera. Revisa la dirección.' });
    }

    // Aporte en unidades mínimas del activo de la caja, sin números decimales flotantes
    const [entero, dec = ''] = amountText.split('.');
    if (dec.length > wa.assetScale) {
      return res.status(400).json({ error: `El aporte no puede tener más de ${wa.assetScale} decimales en ${wa.assetCode}` });
    }
    const contribution = Number(BigInt(entero) * 10n ** BigInt(wa.assetScale) + BigInt(dec.padEnd(wa.assetScale, '0') || '0'));
    if (!Number.isSafeInteger(contribution) || contribution <= 0) {
      return res.status(400).json({ error: 'El aporte es demasiado grande o demasiado pequeño' });
    }

    if ((db.prepare('SELECT COUNT(*) n FROM circles').get() as any).n >= MAX_CIRCLES) {
      return res.status(400).json({ error: 'Ya hay demasiados círculos en este servidor' });
    }
    const ins = db
      .prepare('INSERT INTO circles (name, kind, pot_wallet, contribution, min_approvals, asset_code, asset_scale) VALUES (?,?,?,?,?,?,?)')
      .run(name, kind, wa.id, contribution, minApprovals, wa.assetCode, wa.assetScale);
    const id = Number(ins.lastInsertRowid);
    res.status(201).json({
      circle: { id, name, kind, round: 1, contribution, min_approvals: minApprovals, pot_wallet: wa.id, assetCode: wa.assetCode, assetScale: wa.assetScale },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

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
    id: m.id,
    circle_id: m.circle_id,
    name: m.name,
    country: m.country,
    wallet: m.wallet,
    assetCode: m.asset_code ?? null,
    turn: m.turn,
    hasContributed: activeRoundContribs.has(m.id),
    canRequestPayout: !hasRoundPayout && (circle.kind === 'circulo' || m.turn === currentTurn),
  }));

  const rawLedger = db.prepare(`SELECT c.id, c.member_id, m.name, m.country, c.round, c.receive_value, c.debit_json, c.receive_json, c.pending_json, c.outgoing_id, c.confirmed_at, c.status, c.created_at
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
      outgoingId: r.outgoing_id ?? null,
      confirmedAt: r.confirmed_at ?? null,
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

  res.json({ circle: { ...circle, currentTurn, assetCode: circle.asset_code ?? null, assetScale: circle.asset_scale ?? null }, members, ledger, payouts, reputation: reputation(id) });
});

// Alta de miembro con su propia billetera verificada contra Open Payments
app.post('/api/circles/:id/members', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    if (!checkMemberRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.' });
    }

    const circleId = Number(req.params.id);
    const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
    if (!circle) return res.status(404).json({ error: 'Círculo no existe' });

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (name.length > 40) return res.status(400).json({ error: 'El nombre no puede superar los 40 caracteres' });

    const rawWallet = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : '';
    if (!rawWallet) return res.status(400).json({ error: 'La dirección de billetera es obligatoria' });

    const walletUrl = toUrl(rawWallet);
    if (!isAllowedWalletUrl(walletUrl)) {
      return res.status(400).json({ error: 'Solo se permiten billeteras de la red de pruebas (.interledger-test.dev)' });
    }

    const normUrl = (w: string) => toUrl(w).replace(/\/$/, '').toLowerCase();
    if (normUrl(walletUrl) === normUrl(circle.pot_wallet)) {
      return res.status(400).json({ error: 'Esa es la billetera de la caja del círculo; usa la tuya.' });
    }

    const existingBefore = db.prepare('SELECT name FROM members WHERE circle_id=?').all(circleId) as { name: string }[];
    if (existingBefore.length >= 12) return res.status(400).json({ error: 'El círculo ya está lleno' });
    if (existingBefore.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'Ya existe un miembro con ese nombre en el círculo' });
    }

    let wa: { id: string; assetCode: string; assetScale: number };
    try {
      const c = await getClient();
      wa = await c.walletAddress.get({ url: walletUrl });
    } catch {
      return res.status(400).json({ error: 'No encontramos esa billetera. Revisa la dirección.' });
    }
    if (!wa?.id || !wa?.assetCode) {
      return res.status(400).json({ error: 'No encontramos esa billetera. Revisa la dirección.' });
    }
    if (normUrl(wa.id) === normUrl(circle.pot_wallet)) {
      return res.status(400).json({ error: 'Esa es la billetera de la caja del círculo; usa la tuya.' });
    }

    // Revalidar cupo y nombre único tras el await antes de insertar
    const currentMembers = db.prepare('SELECT name, turn FROM members WHERE circle_id=?').all(circleId) as { name: string; turn: number }[];
    if (currentMembers.length >= 12) return res.status(400).json({ error: 'El círculo ya está lleno' });
    if (currentMembers.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'Ya existe un miembro con ese nombre en el círculo' });
    }

    const turn = currentMembers.reduce((max, m) => Math.max(max, m.turn), 0) + 1;
    const rawCountry = typeof req.body?.country === 'string' ? req.body.country.trim().slice(0, 2).toUpperCase() : '';
    const country = rawCountry.length === 2 ? rawCountry : wa.assetCode;
    const assetCode = wa.assetCode;

    const ins = db
      .prepare('INSERT INTO members (circle_id, name, country, wallet, asset_code, turn) VALUES (?,?,?,?,?,?)')
      .run(circleId, name, country, wa.id, assetCode, turn);
    const memberId = Number(ins.lastInsertRowid);

    const totalMembers = currentMembers.length + 1;
    const currentTurn = ((circle.round - 1) % totalMembers) + 1;
    const hasRoundPayout = Boolean(db.prepare('SELECT id FROM payouts WHERE circle_id=? AND round=?').get(circleId, circle.round));

    res.status(201).json({
      member: {
        id: memberId,
        circle_id: circleId,
        name,
        country,
        wallet: wa.id,
        assetCode,
        turn,
        hasContributed: false,
        canRequestPayout: !hasRoundPayout && (circle.kind === 'circulo' || turn === currentTurn),
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Estado individual de un aporte para el stepper y comprobante de la interfaz
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
    outgoingId: row.outgoing_id ?? null,
    confirmedAt: row.confirmed_at ?? null,
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
      "UPDATE contributions SET status='confirmed', outgoing_id=?, confirmed_at=datetime('now'), pending_json=NULL, error_msg=NULL WHERE id=? AND status='processing'",
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
