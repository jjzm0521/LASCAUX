import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, constants } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`Se requiere Node.js 22 o superior. Versión actual: ${process.version}`);
  process.exit(1);
}
// npm_execpath evita diferencias entre npm y npm.cmd en Windows.
const npmPath = process.env.npm_execpath;
function npm(args) {
  const result = npmPath
    ? spawnSync(process.execPath, [npmPath, ...args], { stdio: 'inherit' })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
        stdio: 'inherit', shell: process.platform === 'win32'
      });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Instalando las versiones fijadas en package-lock.json...');
npm(['ci']);
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env', constants.COPYFILE_EXCL);
  console.log('.env creado. Completa tus credenciales de prueba antes de pagar.');
} else {
  console.log('Se conserva el .env existente.');
}
npm(['run', 'typecheck']);
console.log('\nInstalación lista. Para crear datos de ejemplo una sola vez: npm run seed');
console.log('Para iniciar la aplicación: npm run dev');
console.log('Abre http://localhost:3000/?circle=1 (o el puerto configurado).');
