// Crea un círculo de ejemplo. Edita las billeteras por las de TUS cuentas de prueba.
import 'dotenv/config';
import { db } from './db.js';

const pot = process.env.POT_WALLET ?? 'https://ilp.interledger-test.dev/receptor_op';
const walletCo = process.env.WALLET_CO ?? 'https://ilp.interledger-test.dev/emisor_op';
const walletCo2 = process.env.WALLET_CO2 ?? walletCo;
// Si WALLET_US no existe o coincide con la caja (POT_WALLET), Mamá usa walletCo (COP) y país 'CO' para no mostrar país US con moneda COP
const hasDistinctUsWallet = Boolean(process.env.WALLET_US && process.env.WALLET_US !== pot);
const walletMama = hasDistinctUsWallet ? process.env.WALLET_US! : walletCo;
const countryMama = hasDistinctUsWallet ? 'US' : 'CO';
const kind = process.env.CIRCLE_KIND ?? 'natillera';

const c = db.prepare("INSERT INTO circles (name, kind, pot_wallet, contribution, min_approvals) VALUES ('Natillera Familia Medellín',?,?,1000,2)").run(kind, pot);
const id = Number(c.lastInsertRowid);
const m = db.prepare('INSERT INTO members (circle_id,name,country,wallet,turn) VALUES (?,?,?,?,?)');
m.run(id, 'Mamá', countryMama, walletMama, 1);
m.run(id, 'Juan', 'CO', walletCo, 2);
m.run(id, 'Sofía', 'CO', walletCo2, 3);
console.log('Círculo creado con id', id);
