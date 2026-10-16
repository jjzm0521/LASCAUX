// Crea un círculo de ejemplo. Edita las billeteras por las de TUS cuentas de prueba.
import 'dotenv/config';
import { db } from './db.js';

const pot = process.env.POT_WALLET ?? 'https://ilp.interledger-test.dev/circulo-medellin';
const c = db.prepare("INSERT INTO circles (name, kind, pot_wallet, contribution, min_approvals) VALUES ('Natillera Familia Medellín','natillera',?,1000,2)").run(pot);
const id = Number(c.lastInsertRowid);
const m = db.prepare('INSERT INTO members (circle_id,name,country,wallet,turn) VALUES (?,?,?,?,?)');
m.run(id, 'Mamá', 'US', process.env.WALLET_US ?? 'https://ilp.interledger-test.dev/mama-usa', 1);
m.run(id, 'Juan', 'CO', process.env.WALLET_CO ?? 'https://ilp.interledger-test.dev/juan-med', 2);
m.run(id, 'Sofía', 'CO', process.env.WALLET_CO2 ?? 'https://ilp.interledger-test.dev/sofia-med', 3);
console.log('Círculo creado con id', id);
