import 'dotenv/config';
import express from 'express';
import { db, reputation } from './db.js';
import { startPayment, startPayout, finishPayment, toUrl, getClient, type PendingPayment } from './openPayments.js';

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

// Convierte un monto escrito en decimal ("10.5") a unidades mínimas con BigInt, sin punto flotante
function decimalToMinorUnits(
  rawAmount: unknown,
  assetScale: number,
  assetCode: string,
  word: 'aporte' | 'monto' = 'aporte',
): { value: string } | { error: string } {
  const text = typeof rawAmount === 'string' ? rawAmount.trim() : String(rawAmount ?? '').trim();
  if (!text || !/^\d+(\.\d+)?$/.test(text)) {
    return { error: `El ${word} debe ser un número mayor que cero, por ejemplo 10` };
  }
  const [entero, dec = ''] = text.split('.');
  if (dec.length > assetScale) {
    return { error: `El ${word} no puede tener más de ${assetScale} decimales en ${assetCode}` };
  }
  const minor = BigInt(entero) * 10n ** BigInt(assetScale) + BigInt(dec.padEnd(assetScale, '0') || '0');
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { error: `El ${word} debe ser un número mayor que cero` };
  }
  return { value: minor.toString() };
}

// Mensajes en español exactos de la sección 5 del Contrato v2 según código de error de Open Payments
function formatPayoutError(e: any): string {
  if (e?.code === 'expired' || /cotización venció/i.test(e?.message ?? '')) {
    return 'La cotización venció, vuelve a intentar.';
  }
  if (e?.code === 'rejected') {
    return 'La billetera de la caja rechazó el pago.';
  }
  if (e?.code === 'network') {
    return 'No pudimos conectar con la billetera de prueba, intenta de nuevo.';
  }
  return e?.message ?? 'No pudimos procesar el pago, intenta de nuevo.';
}

// Calcula el estado de la caja (pot) y las participaciones (shares) a partir del libro y entregas
function computePot(circleId: number, rawMembers: any[]) {
  const confirmedRows = db
    .prepare("SELECT member_id, receive_value FROM contributions WHERE circle_id=? AND status='confirmed'")
    .all(circleId) as { member_id: number; receive_value: string }[];
  const byMember = new Map<number, bigint>();
  let contributed = 0n;
  for (const r of confirmedRows) {
    const v = BigInt(r.receive_value || '0');
    contributed += v;
    byMember.set(r.member_id, (byMember.get(r.member_id) ?? 0n) + v);
  }

  const payoutRows = db
    .prepare("SELECT amount, status FROM payouts WHERE circle_id=? AND status IN ('paid','approved','paying','processing_payout')")
    .all(circleId) as { amount: string; status: string }[];
  let paidOut = 0n;
  let reserved = 0n;
  for (const p of payoutRows) {
    const v = BigInt(p.amount || '0');
    if (p.status === 'paid') paidOut += v;
    else reserved += v;
  }

  const balance = contributed > paidOut ? contributed - paidOut : 0n;
  const free = balance > reserved ? balance - reserved : 0n;

  const sortedMembers = [...rawMembers].sort((a, b) => {
    const diff = (byMember.get(b.id) ?? 0n) - (byMember.get(a.id) ?? 0n);
    return diff > 0n ? 1 : diff < 0n ? -1 : a.turn - b.turn;
  });

  let sumShares = 0n;
  const shares = sortedMembers.map((m) => {
    const mc = byMember.get(m.id) ?? 0n;
    const percent = contributed > 0n ? Math.round((Number(mc) / Number(contributed)) * 1000) / 10 : 0;
    const share = contributed > 0n ? (balance * mc) / contributed : 0n;
    sumShares += share;
    return {
      memberId: m.id,
      name: m.name,
      contributed: mc.toString(),
      percent,
      _shareBig: share,
      share: share.toString(),
    };
  });

  if (contributed > 0n && shares.length > 0 && balance > sumShares) {
    const rem = balance - sumShares;
    shares[0]._shareBig += rem;
    shares[0].share = shares[0]._shareBig.toString();
  }

  return {
    contributed: contributed.toString(),
    paidOut: paidOut.toString(),
    reserved: reserved.toString(),
    balance: balance.toString(),
    free: free.toString(),
    shares: shares.map(({ _shareBig, ...rest }) => rest),
  };
}

// Si el servidor cayó durante un callback en vuelo antes de consumir el grant, recupera a 'pending'/'paying' los registros con pending_json.
// Límite: si cae después de consumir grant.continue o de crear el outgoing-payment remoto, el continueToken ya fue usado y no es reintentable.
db.prepare("UPDATE contributions SET status='pending' WHERE status='processing' AND pending_json IS NOT NULL").run();
db.prepare("UPDATE payouts SET status='paying' WHERE status='processing_payout' AND pending_json IS NOT NULL").run();

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

// Pasa a 'failed' las entregas 'paying' cuya cotización ya venció (se pueden reejecutar volviendo a 'approved')
function expirePayingPayouts(circleId?: number) {
  const rows = (circleId !== undefined
    ? db.prepare("SELECT id, pending_json, expires_at FROM payouts WHERE circle_id=? AND status='paying'").all(circleId)
    : db.prepare("SELECT id, pending_json, expires_at FROM payouts WHERE status='paying'").all()) as any[];
  const now = Date.now();
  const markFailed = db.prepare(
    "UPDATE payouts SET status='failed', error_msg='La cotización venció, vuelve a intentar.' WHERE id=? AND status='paying'",
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
  const rows = (
    db.prepare(
      `SELECT c.id, c.name, c.kind, c.round, c.contribution, c.min_approvals, c.status,
        c.asset_code AS assetCode, c.asset_scale AS assetScale,
        (SELECT COUNT(*) FROM members m WHERE m.circle_id=c.id) AS members
       FROM circles c ORDER BY c.id DESC`,
    ).all() as any[]
  ).map((r) => ({
    ...r,
    contribution: r.kind === 'cadena' && r.contribution != null ? String(r.contribution) : null,
    status: r.status ?? 'open',
  }));
  res.json({ circles: rows });
});

const MAX_CIRCLES = 20;
const KINDS = ['natillera', 'cadena', 'circulo'];

// Crear un círculo: valida la billetera de la caja contra Open Payments y convierte el aporte a unidades mínimas (solo obligatorio en cadena)
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

    const amountText = typeof req.body?.amount === 'string' ? req.body.amount.trim() : String(req.body?.amount ?? '').trim();
    if (kind === 'cadena') {
      if (!/^\d+(\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
        return res.status(400).json({ error: 'El aporte debe ser un número mayor que cero, por ejemplo 10' });
      }
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

    let contribution: number | null = null;
    if (kind === 'cadena') {
      const parsed = decimalToMinorUnits(amountText, wa.assetScale, wa.assetCode, 'aporte');
      if ('error' in parsed) return res.status(400).json({ error: parsed.error });
      contribution = Number(parsed.value);
    }

    if ((db.prepare('SELECT COUNT(*) n FROM circles').get() as any).n >= MAX_CIRCLES) {
      return res.status(400).json({ error: 'Ya hay demasiados círculos en este servidor' });
    }
    const ins = db
      .prepare("INSERT INTO circles (name, kind, pot_wallet, contribution, min_approvals, status, asset_code, asset_scale) VALUES (?,?,?,?,?,'open',?,?)")
      .run(name, kind, wa.id, contribution, minApprovals, wa.assetCode, wa.assetScale);
    const id = Number(ins.lastInsertRowid);
    res.status(201).json({
      circle: {
        id,
        name,
        kind,
        round: 1,
        status: 'open',
        contribution: contribution != null ? String(contribution) : null,
        min_approvals: minApprovals,
        pot_wallet: wa.id,
        assetCode: wa.assetCode,
        assetScale: wa.assetScale,
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Estado completo del círculo: miembros, caja (pot), libro de aportes, desembolsos, reputación
app.get('/api/circles/:id', (req, res) => {
  const id = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(id) as any;
  if (!circle) return res.status(404).json({ error: 'No existe' });

  expirePendingContributions(id);
  expirePayingPayouts(id);

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
    db.prepare("SELECT id FROM payouts WHERE circle_id=? AND round=? AND kind='entrega' AND status != 'failed'").get(id, circle.round),
  );

  const circleStatus = circle.status ?? 'open';
  const members = rawMembers.map((m) => ({
    id: m.id,
    circle_id: m.circle_id,
    name: m.name,
    country: m.country,
    wallet: m.wallet,
    assetCode: m.asset_code ?? null,
    turn: m.turn,
    hasContributed: activeRoundContribs.has(m.id),
    canRequestPayout:
      circleStatus !== 'closed' &&
      (circle.kind === 'circulo' ? true : circle.kind === 'cadena' ? !hasRoundPayout && m.turn === currentTurn : false),
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
  const payouts = rawPayouts.map((p) => {
    const debit = parseAmount(p.debit_json);
    let receive = parseAmount(p.receive_json);
    if (!receive && p.pending_json) {
      try {
        receive = parseAmount(JSON.stringify((JSON.parse(p.pending_json) as PendingPayment).receive));
      } catch {}
    }
    return {
      id: p.id,
      member_id: p.member_id,
      name: p.name,
      amount: String(p.amount),
      purpose: p.purpose ?? null,
      kind: p.kind ?? 'entrega',
      closingId: p.closing_id ?? null,
      status: p.status === 'processing_payout' ? 'paying' : p.status,
      approvals: p.approvals,
      approvedBy: (approvalsStmt.all(p.id) as { member_id: number }[]).map((a) => a.member_id),
      round: p.round,
      outgoingId: p.outgoing_id ?? null,
      paidAt: p.paid_at ?? null,
      debit,
      receive,
      error: p.error_msg ?? null,
    };
  });

  const pot = computePot(id, rawMembers);

  res.json({
    circle: {
      id: circle.id,
      name: circle.name,
      kind: circle.kind,
      pot_wallet: circle.pot_wallet,
      contribution: circle.kind === 'cadena' && circle.contribution != null ? String(circle.contribution) : null,
      min_approvals: circle.min_approvals,
      round: circle.round,
      status: circleStatus,
      currentTurn,
      assetCode: circle.asset_code ?? null,
      assetScale: circle.asset_scale ?? null,
    },
    pot,
    members,
    ledger,
    payouts,
    reputation: reputation(id),
  });
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
    const hasRoundPayout = Boolean(
      db.prepare("SELECT id FROM payouts WHERE circle_id=? AND round=? AND kind='entrega' AND status != 'failed'").get(circleId, circle.round),
    );
    const circleStatus = circle.status ?? 'open';

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
        canRequestPayout:
          circleStatus !== 'closed' &&
          (circle.kind === 'circulo' ? true : circle.kind === 'cadena' ? !hasRoundPayout && turn === currentTurn : false),
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
    if ((circle.status ?? 'open') === 'closed') {
      return res.status(400).json({ error: 'Este círculo ya está cerrado' });
    }

    expirePendingContributions(circleId);

    let receiveValue: string;
    if (circle.kind === 'cadena') {
      // En cadena: un solo aporte confirmado (o en confirmación activa) por miembro por ronda, con monto fijo
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
      receiveValue = String(circle.contribution);
    } else {
      // En natillera y círculo solidario: amount obligatorio (decimal en texto -> unidades mínimas de la caja)
      const inFlight = db.prepare(
        "SELECT status FROM contributions WHERE circle_id=? AND member_id=? AND round=? AND status='processing'",
      ).get(circleId, member.id, circle.round) as any;
      if (inFlight) {
        return res.status(400).json({ error: 'Tu aporte se está confirmando en este momento' });
      }
      const parsed = decimalToMinorUnits(
        req.body?.amount,
        circle.asset_scale ?? 2,
        circle.asset_code ?? 'USD',
        'aporte',
      );
      if ('error' in parsed) return res.status(400).json({ error: parsed.error });
      receiveValue = parsed.value;
    }

    // Si el miembro tenía un aporte 'pending' abandonado en la misma ronda, pasa a 'failed' al pedir uno nuevo
    db.prepare(
      "UPDATE contributions SET status='failed', pending_json=NULL, error_msg='Reemplazado por un nuevo intento de aporte' WHERE circle_id=? AND member_id=? AND round=? AND status='pending'",
    ).run(circleId, member.id, circle.round);

    const row = db.prepare('INSERT INTO contributions (circle_id, member_id, round, receive_value) VALUES (?,?,?,?)')
      .run(circleId, member.id, circle.round, receiveValue);
    const contributionId = Number(row.lastInsertRowid);

    try {
      const { redirectUrl, state } = await startPayment({
        senderWallet: member.wallet,
        receiverWallet: circle.pot_wallet,
        receiveValue,
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
      const msg = e?.code === 'network' ? 'No pudimos conectar con la billetera de prueba, intenta de nuevo.' : (e?.message ?? 'Error al iniciar el pago');
      db.prepare("UPDATE contributions SET status='failed', error_msg=? WHERE id=?").run(msg, contributionId);
      return res.status(502).json({ error: msg });
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
    const msg = e?.code === 'network' ? 'No pudimos conectar con la billetera de prueba, intenta de nuevo.' : (e?.message ?? 'Error al confirmar el aporte');
    db.prepare(
      "UPDATE contributions SET status='failed', pending_json=NULL, error_msg=? WHERE id=? AND status='processing'",
    ).run(msg, id);
    res.redirect(`/?circle=${row.circle_id}&error=${encodeURIComponent(msg)}`);
  }
});

// Abrir la ronda siguiente manualmente (natillera y círculo solidario; en cadena cambia sola al pagarse la entrega)
app.post('/api/circles/:id/rounds/next', (req, res) => {
  const circleId = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
  if (!circle) return res.status(404).json({ error: 'Círculo no existe' });
  if ((circle.status ?? 'open') === 'closed') {
    return res.status(400).json({ error: 'Este círculo ya está cerrado' });
  }
  if (circle.kind === 'cadena') {
    return res.status(400).json({ error: 'En una cadena la ronda cambia sola al pagar la entrega' });
  }
  const member = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body?.memberId, circleId) as any;
  if (!member) return res.status(404).json({ error: 'Miembro no pertenece al círculo' });

  const round = circle.round + 1;
  db.prepare('UPDATE circles SET round=? WHERE id=?').run(round, circleId);
  res.json({ round });
});

// 3) Solicitud de entrega (payout kind='entrega') según reglas de cada tipo de círculo
app.post('/api/circles/:id/payouts', (req, res) => {
  const circleId = Number(req.params.id);
  const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(circleId) as any;
  if (!circle) return res.status(404).json({ error: 'Círculo no existe' });
  if ((circle.status ?? 'open') === 'closed') {
    return res.status(400).json({ error: 'Este círculo ya está cerrado' });
  }

  if (circle.kind === 'natillera') {
    return res.status(400).json({ error: 'En una natillera la caja se reparte al cierre' });
  }

  const member = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body?.memberId, circleId) as any;
  if (!member) return res.status(404).json({ error: 'Miembro no pertenece al círculo' });

  const rawMembers = db.prepare('SELECT * FROM members WHERE circle_id=? ORDER BY turn').all(circleId) as any[];
  const membersCount = rawMembers.length;
  if (!membersCount) return res.status(400).json({ error: 'El círculo no tiene miembros' });

  expirePendingContributions(circleId);
  expirePayingPayouts(circleId);

  const pot = computePot(circleId, rawMembers);
  let amount: string;

  if (circle.kind === 'cadena') {
    const expectedTurn = ((circle.round - 1) % membersCount) + 1;
    if (member.turn !== expectedTurn) {
      return res.status(400).json({ error: `En la ronda ${circle.round} el turno de entrega corresponde al turno ${expectedTurn}` });
    }
    const existing = db
      .prepare("SELECT id FROM payouts WHERE circle_id=? AND round=? AND kind='entrega' AND status != 'failed'")
      .get(circleId, circle.round);
    if (existing) {
      return res.status(400).json({ error: `Ya existe una entrega activa en la ronda ${circle.round}` });
    }
    const confirmedMembers = (
      db.prepare(
        "SELECT COUNT(DISTINCT member_id) n FROM contributions WHERE circle_id=? AND round=? AND status='confirmed'",
      ).get(circleId, circle.round) as any
    ).n;
    if (confirmedMembers < membersCount) {
      return res.status(400).json({ error: 'Faltan aportes de esta ronda: todavía no se puede entregar.' });
    }
    const roundRows = db
      .prepare("SELECT receive_value FROM contributions WHERE circle_id=? AND round=? AND status='confirmed'")
      .all(circleId, circle.round) as { receive_value: string }[];
    const roundSum = roundRows.reduce((acc, r) => acc + BigInt(r.receive_value || '0'), 0n);
    if (roundSum <= 0n || roundSum > BigInt(pot.free)) {
      return res.status(400).json({ error: 'La caja no tiene saldo suficiente para esta entrega.' });
    }
    amount = roundSum.toString();
  } else {
    // circulo solidario: cualquier miembro, amount obligatorio y <= pot.free
    const parsed = decimalToMinorUnits(
      req.body?.amount,
      circle.asset_scale ?? 2,
      circle.asset_code ?? 'USD',
      'monto',
    );
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    if (BigInt(parsed.value) > BigInt(pot.free)) {
      return res.status(400).json({ error: 'La caja no tiene saldo suficiente para esta entrega.' });
    }
    amount = parsed.value;
  }

  const purpose = typeof req.body?.purpose === 'string' && req.body.purpose.trim() ? req.body.purpose.trim() : null;

  const r = db
    .prepare("INSERT INTO payouts (circle_id, member_id, round, amount, purpose, kind, status) VALUES (?,?,?,?,?,'entrega','requested')")
    .run(circleId, member.id, circle.round, amount, purpose);
  res.json({ payoutId: Number(r.lastInsertRowid), amount, purpose, kind: 'entrega', status: 'requested', round: circle.round });
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

  let status = payout.status === 'processing_payout' ? 'paying' : payout.status;
  if (n >= circle.min_approvals && payout.status === 'requested') {
    status = 'approved';
    db.prepare("UPDATE payouts SET status='approved' WHERE id=? AND status='requested'").run(id);
  }
  res.json({ approvals: n, needed: circle.min_approvals, status, round: circle.round });
});

// Estado individual de una entrega para el stepper y el comprobante
app.get('/api/payouts/:id', (req, res) => {
  const id = Number(req.params.id);
  const initial = db.prepare('SELECT circle_id FROM payouts WHERE id=?').get(id) as { circle_id: number } | undefined;
  if (!initial) return res.status(404).json({ error: 'Entrega no encontrada' });

  expirePayingPayouts(initial.circle_id);

  const row = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
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
    kind: row.kind ?? 'entrega',
    closingId: row.closing_id ?? null,
    amount: String(row.amount),
    status: row.status === 'processing_payout' ? 'paying' : row.status,
    expiresAt,
    debit,
    receive,
    outgoingId: row.outgoing_id ?? null,
    paidAt: row.paid_at ?? null,
  };
  if (row.error_msg) out.error = row.error_msg;
  res.json(out);
});

// 4) Ejecutar entrega aprobada -> prepara cotización por debitAmount desde la billetera de la caja hacia el miembro
app.post('/api/payouts/:id/execute', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    if (!checkMemberRateLimit('payout:' + ip)) {
      return res.status(429).json({ error: 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.' });
    }

    const id = Number(req.params.id);
    const initial = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
    if (!initial) return res.status(404).json({ error: 'Entrega no encontrada' });

    const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(initial.circle_id) as any;
    if (!circle) return res.status(404).json({ error: 'Círculo no existe' });
    if ((circle.status ?? 'open') === 'closed') {
      return res.status(400).json({ error: 'Este círculo ya está cerrado' });
    }

    if (req.body?.memberId !== undefined) {
      const executor = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(req.body.memberId, circle.id) as any;
      if (!executor) return res.status(404).json({ error: 'Miembro no pertenece al círculo' });
    }

    expirePayingPayouts(circle.id);

    let payout = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
    // Las entregas 'failed' por vencimiento (o fallo previo a crear el pago) vuelven a 'approved' al pedir execute de nuevo
    if (payout.status === 'failed' && !payout.outgoing_id) {
      db.prepare("UPDATE payouts SET status='approved', error_msg=NULL, pending_json=NULL, expires_at=NULL WHERE id=? AND status='failed'").run(id);
      payout = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
    }

    if (payout.status !== 'approved') {
      return res.status(400).json({
        error:
          payout.status === 'paying' || payout.status === 'processing_payout'
            ? 'Esta entrega ya está en proceso de pago'
            : payout.status === 'paid'
              ? 'Esta entrega ya fue pagada'
              : 'Solo se pueden ejecutar entregas aprobadas',
      });
    }

    const activePaying = db
      .prepare("SELECT id FROM payouts WHERE circle_id=? AND status IN ('paying','processing_payout')")
      .get(circle.id) as any;
    if (activePaying) {
      return res.status(400).json({ error: 'Ya hay una entrega en proceso de pago en este círculo' });
    }

    const recipient = db.prepare('SELECT * FROM members WHERE id=? AND circle_id=?').get(payout.member_id, circle.id) as any;
    if (!recipient) return res.status(404).json({ error: 'Miembro destinatario no existe' });

    const rawMembers = db.prepare('SELECT * FROM members WHERE circle_id=? ORDER BY turn').all(circle.id) as any[];
    const pot = computePot(circle.id, rawMembers);
    // payout está en 'approved', por lo que su monto ya está incluido en pot.reserved
    const availableForThisPayout = BigInt(pot.free) + BigInt(payout.amount);
    if (BigInt(payout.amount) > BigInt(pot.balance) || BigInt(payout.amount) > availableForThisPayout) {
      return res.status(400).json({ error: 'La caja no tiene saldo suficiente para esta entrega.' });
    }

    // Reserva atómica antes del await: una sola entrega en 'paying' por círculo
    const claim = db
      .prepare(
        "UPDATE payouts SET status='paying', error_msg=NULL WHERE id=? AND status='approved' AND NOT EXISTS (SELECT 1 FROM payouts WHERE circle_id=? AND id != ? AND status IN ('paying','processing_payout'))",
      )
      .run(id, circle.id, id);
    if (claim.changes === 0) {
      return res.status(400).json({ error: 'Ya hay una entrega en proceso de pago en este círculo' });
    }

    try {
      const { redirectUrl, state } = await startPayout({
        potWallet: circle.pot_wallet,
        memberWallet: recipient.wallet,
        debitValue: String(payout.amount),
        finishUri: `${BASE}/api/payouts/${id}/finish`,
      });
      db.prepare('UPDATE payouts SET pending_json=?, debit_json=?, receive_json=?, expires_at=?, error_msg=NULL WHERE id=?').run(
        JSON.stringify(state),
        JSON.stringify(state.debit),
        JSON.stringify(state.receive),
        state.expiresAt ?? null,
        id,
      );
      res.json({ redirectUrl, debit: state.debit, receive: state.receive, expiresAt: state.expiresAt });
    } catch (e: any) {
      const msg = formatPayoutError(e);
      db.prepare("UPDATE payouts SET status='failed', pending_json=NULL, error_msg=? WHERE id=?").run(msg, id);
      return res.status(502).json({ error: msg });
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 5) Callback de autorización de la billetera de la caja para la entrega
app.get('/api/payouts/:id/finish', async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM payouts WHERE id=?').get(id) as any;
  if (!row) return res.status(404).send('Entrega no encontrada');
  if (!row.pending_json || row.status === 'paid' || row.status === 'processing_payout') {
    return res.redirect(`/?circle=${row.circle_id}`);
  }

  // Reserva atómica antes del primer await conservando pending_json
  const claim = db
    .prepare("UPDATE payouts SET status='processing_payout' WHERE id=? AND pending_json IS NOT NULL AND status IN ('paying','failed')")
    .run(id);
  if (claim.changes === 0) return res.redirect(`/?circle=${row.circle_id}`);

  try {
    if (req.query.result === 'grant_rejected') {
      throw { code: 'rejected', message: 'La billetera de la caja rechazó el pago.' };
    }
    const outgoing = await finishPayment({
      state: JSON.parse(row.pending_json) as PendingPayment,
      interactRef: String(req.query.interact_ref),
      hash: String(req.query.hash),
    });
    const upd = db
      .prepare(
        "UPDATE payouts SET status='paid', outgoing_id=?, paid_at=datetime('now'), pending_json=NULL, error_msg=NULL WHERE id=? AND status='processing_payout'",
      )
      .run(outgoing.id, id);

    if (upd.changes > 0) {
      const circle = db.prepare('SELECT * FROM circles WHERE id=?').get(row.circle_id) as any;
      if (circle && circle.kind === 'cadena') {
        db.prepare('UPDATE circles SET round = round + 1 WHERE id=?').run(circle.id);
      }
    }
    res.redirect(`/?circle=${row.circle_id}&payout=ok&p=${id}`);
  } catch (e: any) {
    console.error(e);
    const msg = formatPayoutError(e);
    db.prepare("UPDATE payouts SET status='failed', pending_json=NULL, error_msg=? WHERE id=? AND status='processing_payout'").run(
      msg,
      id,
    );
    res.redirect(`/?circle=${row.circle_id}&payout=error&p=${id}&error=${encodeURIComponent(msg)}`);
  }
});

app.listen(Number(process.env.PORT ?? 3000), () => console.log(`Círculos en ${BASE}`));
