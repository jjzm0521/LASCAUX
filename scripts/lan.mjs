// Muestra con qué dirección se conectan los demás al servidor de este computador.
//   node scripts/lan.mjs
// Después pon esa dirección en BASE_URL dentro de .env y reinicia `npm run dev`.
import { networkInterfaces } from 'node:os';

const puerto = process.env.PORT ?? 3000;
const direcciones = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

if (!direcciones.length) {
  console.log('No encontré una red local. Conéctate al wifi y vuelve a correr este comando.');
  process.exit(1);
}

console.log('Direcciones para que otros entren desde su celular o computador (misma red wifi):\n');
for (const ip of direcciones) console.log(`  http://${ip}:${puerto}/?circle=1`);
console.log(`\nEn .env pon la misma dirección SIN la ruta, por ejemplo:\n\n  BASE_URL=http://${direcciones[0]}:${puerto}\n`);
console.log('Por qué: al terminar de autorizar, la billetera devuelve el navegador de cada persona a BASE_URL.');
console.log('Si dejas localhost, solo funciona en este computador.');
